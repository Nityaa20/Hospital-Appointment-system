/* ─── STATE ─── */
let STATE = {
  user: null,
  doctorInfo: null,
  departments: [],
  allDoctors: [],
  editingApptId: null,
  isRegistering: false,
};

/* ─── INIT ─── */
window.addEventListener('DOMContentLoaded', async () => {
  const stored = localStorage.getItem('mf_user');
  if (stored) {
    STATE.user = JSON.parse(stored);
    await initRole(STATE.user.role);
  } else {
    showPage('role');
  }
  setTodayMin();
});

function setTodayMin() {
  const today = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[type="date"]').forEach(el => { el.min = today; });
}

/* ─── NAVIGATION ─── */
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + name);
  if (el) el.classList.add('active');
}

let currentRole = '';
let isRegistering = false;

function goToLogin(role) {
  currentRole = role;
  isRegistering = false;
  document.getElementById('loginRoleBadge').className = 'role-badge ' + role;
  document.getElementById('loginRoleBadge').innerText = role.charAt(0).toUpperCase() + role.slice(1);
  document.getElementById('loginSub').innerText = `Sign in to your ${role} portal`;
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginBtn').innerText = 'Sign In →';
  document.getElementById('patientRegToggle').style.display = role === 'patient' ? 'block' : 'none';
  document.getElementById('registerFields').style.display = 'none';
  document.getElementById('regToggleText').innerText = "Don't have an account?";
  document.getElementById('regToggleBtn').innerText = 'Register';

  const extras = document.getElementById('doctorLoginExtras');
  if (role === 'doctor') {
    extras.style.display = 'block';
    loadDeptSelectLogin();
  } else {
    extras.style.display = 'none';
  }

  showPage('login');
}

async function loadDeptSelectLogin() {
  if (!STATE.departments.length) STATE.departments = await Api.getDepts();
  const sel = document.getElementById('loginDept');
  sel.innerHTML = '<option value="">Select Department</option>' +
    STATE.departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  document.getElementById('loginDrSelect').innerHTML = '<option value="">Select your name</option>';
}

async function loginDeptChanged() {
  const deptId = document.getElementById('loginDept').value;
  const doctors = deptId ? await Api.getDoctors(deptId) : [];
  const sel = document.getElementById('loginDrSelect');
  sel.innerHTML = '<option value="">Select your name</option>' +
    doctors.map(d => `<option value="${d.name.toLowerCase().split(' ').pop()}">${d.name}</option>`).join('');
  sel.onchange = () => { document.getElementById('loginUsername').value = sel.value; };
}

function toggleRegister() {
  isRegistering = !isRegistering;
  document.getElementById('registerFields').style.display = isRegistering ? 'block' : 'none';
  document.getElementById('loginBtn').innerText = isRegistering ? 'Register →' : 'Sign In →';
  document.getElementById('regToggleText').innerText = isRegistering ? 'Already have an account?' : "Don't have an account?";
  document.getElementById('regToggleBtn').innerText = isRegistering ? 'Sign In' : 'Register';
}

function togglePw() {
  const el = document.getElementById('loginPassword');
  el.type = el.type === 'password' ? 'text' : 'password';
}

async function handleLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  if (!username || !password) { toast('Please enter username and password.', 'error'); return; }

  try {
    let data;
    if (isRegistering && currentRole === 'patient') {
      const fullName = document.getElementById('regFullName').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const phone = document.getElementById('regPhone').value.trim();
      if (!fullName) { toast('Full name is required.', 'error'); return; }
      data = await Api.register({ username, password, full_name: fullName, email, phone });
    } else {
      data = await Api.login({ username, password, role: currentRole });
    }

    localStorage.setItem('mf_token', data.token);
    localStorage.setItem('mf_user', JSON.stringify(data.user));
    STATE.user = data.user;

    if (currentRole === 'doctor') {
      STATE.doctorInfo = { doctor_id: data.doctor_id, doctor_name: data.doctor_name, department: data.department, room: data.room };
      localStorage.setItem('mf_doctor', JSON.stringify(STATE.doctorInfo));
    }

    await initRole(data.user.role);
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function initRole(role) {
  if (!STATE.departments.length) STATE.departments = await Api.getDepts();
  if (!STATE.allDoctors.length) STATE.allDoctors = await Api.getDoctors();

  if (role === 'patient') {
    await initPatient();
    showPage('patient');
  } else if (role === 'doctor') {
    const stored = localStorage.getItem('mf_doctor');
    if (stored) STATE.doctorInfo = JSON.parse(stored);
    await initDoctor();
    showPage('doctor');
  } else if (role === 'receptionist') {
    await initReception();
    showPage('reception');
  }
}

function logout() {
  localStorage.removeItem('mf_token');
  localStorage.removeItem('mf_user');
  localStorage.removeItem('mf_doctor');
  STATE = { user: null, doctorInfo: null, departments: [], allDoctors: [], editingApptId: null };
  showPage('role');
}

/* ─── DEPT / DOCTOR SELECTS ─── */
async function deptChanged(deptSelId, drSelId, roomId) {
  const deptId = document.getElementById(deptSelId).value;
  const drSel = document.getElementById(drSelId);
  drSel.innerHTML = '<option value="">Select Doctor</option>';
  if (roomId) document.getElementById(roomId).value = '';

  if (!deptId) return;
  const doctors = await Api.getDoctors(deptId);
  drSel.innerHTML += doctors.map(d => `<option value="${d.id}" data-room="${d.room}">${d.name}</option>`).join('');
}

function drChanged(drSelId, roomId, slotWrapId, dateId) {
  const sel = document.getElementById(drSelId);
  const opt = sel.options[sel.selectedIndex];
  if (roomId) document.getElementById(roomId).value = opt?.dataset?.room || '';
  if (slotWrapId && dateId) {
    const dateVal = document.getElementById(dateId)?.value;
    if (dateVal && sel.value) loadSlots(dateId, drSelId, slotWrapId.replace('Wrap',''));
  }
}

async function loadSlots(dateId, drSelId, slotSelId) {
  const date = document.getElementById(dateId)?.value;
  const drId = document.getElementById(drSelId)?.value;
  const slotSel = document.getElementById(slotSelId);
  if (!slotSel) return;

  if (!date || !drId) {
    slotSel.innerHTML = '<option value="">Select slot</option>';
    return;
  }

  const slots = await Api.getSlots(drId, date);
  slotSel.innerHTML = '<option value="">Select slot</option>' +
    slots.map(s => `<option value="${s.slot}" ${!s.available ? 'disabled' : ''}>${s.slot}${!s.available ? ' (Booked)' : ''}</option>`).join('');
}

function populateDeptSelect(selId) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  sel.innerHTML = '<option value="">Select Department</option>' +
    STATE.departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
}

/* ─── PATIENT ─── */
async function initPatient() {
  const u = STATE.user;
  document.getElementById('patientNavName').innerText = u.full_name || u.username;
  document.getElementById('patientNavAvatar').innerText = (u.full_name || u.username)[0].toUpperCase();

  populateDeptSelect('pDept');
  setTodayMin();
  await loadPatientStats();
  await loadPatientAppts();
}

async function loadPatientStats() {
  const s = await Api.getStats();
  document.getElementById('patientStats').innerHTML = `
    <div class="stat-card"><div class="stat-val" style="color:var(--blue)">${s.total}</div><div class="stat-label">Total Appointments</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--amber)">${s.pending}</div><div class="stat-label">Pending</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--green)">${s.attended}</div><div class="stat-label">Attended</div></div>
  `;
}

async function loadPatientAppts() {
  const params = {};
  const s = document.getElementById('pStatusFilter')?.value; if (s) params.status = s;
  const d = document.getElementById('pDateFilter')?.value; if (d) params.date = d;
  const search = document.getElementById('pSearch')?.value; if (search) params.search = search;

  const appts = await Api.getAppts(params);
  const tbody = document.getElementById('patientTbody');
  if (!appts.length) { tbody.innerHTML = emptyRow(7, 'No appointments found.'); return; }

  tbody.innerHTML = appts.map(a => `
    <tr>
      <td><span class="appt-id">#${a.id}</span></td>
      <td><strong>${a.doctor_name}</strong></td>
      <td>${deptPill(a.department)}</td>
      <td>${fmtDate(a.appointment_date)}<br><small style="color:var(--text2)">${a.time_slot}</small></td>
      <td style="font-size:0.82rem">${a.room || '—'}</td>
      <td>${statusBadge(a.status)}</td>
      <td>
        <div class="td-actions">
          ${a.status === 'Pending' ? `
            <button class="btn btn-outline btn-sm" onclick="openEditAppt(${a.id})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="cancelAppt(${a.id},'patient')">Cancel</button>
          ` : `<span style="font-size:0.8rem;color:var(--text3)">${a.status === 'Attended' ? '✅ Done' : '❌'}</span>`}
        </div>
      </td>
    </tr>
  `).join('');
}

async function submitBooking() {
  const doctorId = document.getElementById('pDr').value;
  const data = {
    doctor_id: doctorId ? parseInt(doctorId) : null,
    patient_name: document.getElementById('pName').value.trim(),
    patient_age: document.getElementById('pAge').value.trim(),
    patient_sex: document.getElementById('pSex').value,
    patient_phone: document.getElementById('pPhone').value.trim(),
    reason: document.getElementById('pReason').value.trim(),
    appointment_date: document.getElementById('pDate').value,
    time_slot: document.getElementById('pSlot').value,
  };

  if (!data.patient_name || !data.patient_age || !data.patient_sex || !data.patient_phone || !data.doctor_id || !data.appointment_date || !data.time_slot) {
    toast('Please fill all required fields (*).', 'error'); return;
  }

  try {
    if (STATE.editingApptId) {
      await Api.updateAppt(STATE.editingApptId, data);
      toast('Appointment updated successfully!', 'success');
      cancelEdit();
    } else {
      const appt = await Api.createAppt(data);
      toast(`✅ Booked! Appt ID: #${appt.id}. SMS confirmation sent to ${data.patient_phone}.`, 'success', 6000);
      clearBookingForm();
    }
    await loadPatientAppts();
    await loadPatientStats();
    switchTabById('p-history', 'patient');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function openEditAppt(id) {
  const appts = await Api.getAppts();
  const a = appts.find(x => x.id === id);
  if (!a) return;
  STATE.editingApptId = id;

  document.getElementById('bookCardTitle').innerText = `✏️ Edit Appointment #${id}`;
  document.getElementById('bookBtn').innerText = 'Update Appointment';
  document.getElementById('cancelEditBtn').style.display = 'inline-flex';

  document.getElementById('pName').value = a.patient_name;
  document.getElementById('pAge').value = a.patient_age;
  document.getElementById('pSex').value = a.patient_sex;
  document.getElementById('pPhone').value = a.patient_phone;

  // Set dept
  const dept = STATE.departments.find(d => d.name === a.department);
  if (dept) {
    document.getElementById('pDept').value = dept.id;
    await deptChanged('pDept', 'pDr', 'pRoom');
  }
  await sleep(80);
  document.getElementById('pDr').value = a.doctor_id;
  document.getElementById('pRoom').value = a.room || '';
  document.getElementById('pDate').value = a.appointment_date;
  await loadSlots('pDate', 'pDr', 'pSlot');
  await sleep(80);
  document.getElementById('pSlot').value = a.time_slot;
  document.getElementById('pReason').value = a.reason || '';

  switchTabById('p-book', 'patient');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
  STATE.editingApptId = null;
  document.getElementById('bookCardTitle').innerText = '📝 Book New Appointment';
  document.getElementById('bookBtn').innerText = 'Book Appointment';
  document.getElementById('cancelEditBtn').style.display = 'none';
  clearBookingForm();
}

function clearBookingForm() {
  ['pName', 'pAge', 'pPhone', 'pReason', 'pDate'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('pSex').value = '';
  document.getElementById('pDept').value = '';
  document.getElementById('pDr').innerHTML = '<option value="">Select Doctor</option>';
  document.getElementById('pRoom').value = '';
  document.getElementById('pSlot').innerHTML = '<option value="">Select slot</option>';
}

async function cancelAppt(id, from) {
  if (!confirm('Are you sure you want to cancel this appointment?')) return;
  try {
    await Api.updateStatus(id, 'Cancelled');
    toast('Appointment cancelled.', 'info');
    if (from === 'patient') { await loadPatientAppts(); await loadPatientStats(); }
    if (from === 'reception') { await loadRecepAppts(); await loadRecepStats(); closeModal(); }
  } catch (err) { toast(err.message, 'error'); }
}

/* ─── DOCTOR ─── */
async function initDoctor() {
  const info = STATE.doctorInfo;
  if (!info) return;
  document.getElementById('drNavName').innerText = info.doctor_name;
  document.getElementById('drNavAvatar').innerText = getInitials(info.doctor_name);
  document.getElementById('drHeroName').innerText = info.doctor_name;
  document.getElementById('drHeroDept').innerText = (info.department || '') + ' Department';
  document.getElementById('drHeroRoom').innerText = info.room || '';
  document.getElementById('drHeroAv').innerText = getInitials(info.doctor_name);

  await loadDrStats();
  await loadDrAppts();
}

async function loadDrStats() {
  const s = await Api.getStats();
  document.getElementById('drStats').innerHTML = `
    <div class="stat-card"><div class="stat-val" style="color:var(--teal)">${s.total}</div><div class="stat-label">Total Patients</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--amber)">${s.today_pending}</div><div class="stat-label">Today Pending</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--green)">${s.attended}</div><div class="stat-label">Attended</div></div>
  `;
}

async function loadDrAppts() {
  const params = {};
  const s = document.getElementById('drStatusFilter')?.value; if (s) params.status = s;
  const d = document.getElementById('drDateFilter')?.value; if (d) params.date = d;

  const appts = await Api.getAppts(params);
  const tbody = document.getElementById('drTbody');
  if (!appts.length) { tbody.innerHTML = emptyRow(8, 'No appointments for this filter.'); return; }

  tbody.innerHTML = appts.map(a => `
    <tr>
      <td>${fmtDate(a.appointment_date)}</td>
      <td><strong>${a.time_slot}</strong></td>
      <td>${a.patient_name}</td>
      <td style="white-space:nowrap">${a.patient_age || '—'} / ${a.patient_sex || '—'}</td>
      <td style="font-size:0.82rem">${a.patient_phone || '—'}</td>
      <td style="font-size:0.82rem;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.reason || '—'}</td>
      <td>${statusBadge(a.status)}</td>
      <td>
        ${a.status === 'Pending' ?
          `<button class="btn btn-success btn-sm" onclick="markAttended(${a.id})">Mark Attended</button>` :
          `<span style="font-size:0.82rem;color:var(--text3)">${a.status === 'Attended' ? '✅ Done' : '❌ Cancelled'}</span>`}
      </td>
    </tr>
  `).join('');
}

async function markAttended(id) {
  try {
    await Api.updateStatus(id, 'Attended');
    toast('Patient marked as attended.', 'success');
    await loadDrAppts(); await loadDrStats();
  } catch (err) { toast(err.message, 'error'); }
}

function clearFilters(role) {
  if (role === 'doctor') {
    document.getElementById('drDateFilter').value = '';
    document.getElementById('drStatusFilter').value = '';
    loadDrAppts();
  } else if (role === 'patient') {
    document.getElementById('pSearch').value = '';
    document.getElementById('pStatusFilter').value = '';
    document.getElementById('pDateFilter').value = '';
    loadPatientAppts();
  } else {
    document.getElementById('rSearch').value = '';
    document.getElementById('rDeptFilter').value = '';
    document.getElementById('rStatusFilter').value = '';
    document.getElementById('rDateFilter').value = '';
    loadRecepAppts();
  }
}

/* ─── RECEPTION ─── */
async function initReception() {
  populateDeptSelect('rDept');
  populateDeptSelect('wDept');
  populateDeptSelect('avDept');

  // Dept filter for table
  const rDeptFilter = document.getElementById('rDeptFilter');
  rDeptFilter.innerHTML = '<option value="">All Departments</option>' +
    STATE.departments.map(d => `<option value="${d.name}">${d.name}</option>`).join('');

  setTodayMin();
  await loadRecepStats();
  await loadRecepAppts();
}

async function loadRecepStats() {
  const s = await Api.getStats();
  document.getElementById('recepStats').innerHTML = `
    <div class="stat-card"><div class="stat-val" style="color:var(--blue)">${s.total}</div><div class="stat-label">Total Appointments</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--amber)">${s.pending}</div><div class="stat-label">Pending</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--green)">${s.today}</div><div class="stat-label">Today Pending</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--rose)">${s.cancelled}</div><div class="stat-label">Cancelled</div></div>
  `;
}

async function loadRecepAppts() {
  const params = {};
  const s = document.getElementById('rStatusFilter')?.value; if (s) params.status = s;
  const d = document.getElementById('rDateFilter')?.value; if (d) params.date = d;
  const dept = document.getElementById('rDeptFilter')?.value; if (dept) params.department = dept;
  const search = document.getElementById('rSearch')?.value; if (search) params.search = search;

  const appts = await Api.getAppts(params);
  const tbody = document.getElementById('recepTbody');
  if (!appts.length) { tbody.innerHTML = emptyRow(8, 'No appointments match your filters.'); return; }

  tbody.innerHTML = appts.map(a => `
    <tr>
      <td><span class="appt-id">#${a.id}</span></td>
      <td><strong>${a.patient_name}</strong><br><small style="color:var(--text2)">${a.patient_phone || ''}</small></td>
      <td style="font-size:0.875rem">${a.doctor_name}</td>
      <td>${deptPill(a.department)}</td>
      <td>${fmtDate(a.appointment_date)}<br><small style="color:var(--text2)">${a.time_slot}</small></td>
      <td style="font-size:0.82rem">${a.room || '—'}</td>
      <td>${statusBadge(a.status)}</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-outline btn-sm" onclick="openApptModal(${a.id})">Details</button>
          ${a.status === 'Pending' ? `<button class="btn btn-danger btn-sm" onclick="cancelAppt(${a.id},'reception')">Cancel</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

let _allRecepAppts = [];
async function openApptModal(id) {
  const appts = await Api.getAppts();
  const a = appts.find(x => x.id === id);
  if (!a) return;

  document.getElementById('modalBox').innerHTML = `
    <div class="modal-title">Appointment Details</div>
    <table class="modal-detail-table">
      <tr><td>Appointment ID</td><td><span class="appt-id">#${a.id}</span></td></tr>
      <tr><td>Patient Name</td><td>${a.patient_name}</td></tr>
      <tr><td>Age / Sex</td><td>${a.patient_age || '—'} / ${a.patient_sex || '—'}</td></tr>
      <tr><td>Phone</td><td>${a.patient_phone || '—'}</td></tr>
      <tr><td>Doctor</td><td>${a.doctor_name}</td></tr>
      <tr><td>Department</td><td>${a.department}</td></tr>
      <tr><td>Room</td><td>${a.room || '—'}</td></tr>
      <tr><td>Date</td><td>${fmtDate(a.appointment_date)}</td></tr>
      <tr><td>Time Slot</td><td>${a.time_slot}</td></tr>
      <tr><td>Reason</td><td>${a.reason || '—'}</td></tr>
      <tr><td>Status</td><td>${statusBadge(a.status)}</td></tr>
      <tr><td>Booked By</td><td style="text-transform:capitalize">${a.booked_by}</td></tr>
    </table>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
      ${a.status === 'Pending' ? `
        <button class="btn btn-success btn-sm" onclick="recepMarkAttended(${a.id})">Mark Attended</button>
        <button class="btn btn-danger btn-sm" onclick="cancelAppt(${a.id},'reception')">Cancel</button>
      ` : ''}
    </div>
  `;
  openModal();
}

async function recepMarkAttended(id) {
  try {
    await Api.updateStatus(id, 'Attended');
    toast('Marked as attended.', 'success');
    closeModal();
    await loadRecepAppts(); await loadRecepStats();
  } catch (err) { toast(err.message, 'error'); }
}

async function submitWalkin() {
  const doctorId = document.getElementById('wDr').value;
  const data = {
    doctor_id: doctorId ? parseInt(doctorId) : null,
    patient_name: document.getElementById('wName').value.trim(),
    patient_age: document.getElementById('wAge').value.trim(),
    patient_sex: document.getElementById('wSex').value,
    patient_phone: document.getElementById('wPhone').value.trim() || 'Walk-in',
    reason: document.getElementById('wReason').value.trim(),
    appointment_date: document.getElementById('wDate').value,
    time_slot: document.getElementById('wSlot').value,
  };

  if (!data.patient_name || !data.doctor_id || !data.appointment_date || !data.time_slot) {
    toast('Please fill required fields.', 'error'); return;
  }

  try {
    const appt = await Api.createAppt(data);
    toast(`Walk-in registered! ID: #${appt.id}`, 'success');
    ['wName','wPhone','wAge','wReason','wDate'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    document.getElementById('wDept').value = '';
    document.getElementById('wDr').innerHTML = '<option value="">Select Doctor</option>';
    document.getElementById('wRoom').value = '';
    document.getElementById('wSlot').innerHTML = '<option value="">Select slot</option>';
    await loadRecepAppts(); await loadRecepStats();
    switchTabById('r-all', 'reception');
  } catch (err) { toast(err.message, 'error'); }
}

async function checkAvailability() {
  const drId = document.getElementById('avDr').value;
  const date = document.getElementById('avDate').value;
  if (!drId || !date) { toast('Select a doctor and date.', 'error'); return; }

  const slots = await Api.getSlots(drId, date);
  const drName = document.getElementById('avDr').options[document.getElementById('avDr').selectedIndex]?.text || '';
  const free = slots.filter(s => s.available).length;
  const taken = slots.filter(s => !s.available).length;

  document.getElementById('availResult').innerHTML = `
    <div style="margin-bottom:14px;">
      <strong>${drName}</strong> — ${fmtDate(date)}
      <span style="margin-left:12px;font-size:0.82rem;color:var(--text2)">✓ ${free} available &nbsp;✕ ${taken} booked</span>
    </div>
    <div class="slot-grid">
      ${slots.map(s => `<span class="slot-chip ${s.available ? 'slot-free' : 'slot-taken'}">${s.slot} ${s.available ? '✓' : '✕'}</span>`).join('')}
    </div>
  `;
}

/* ─── TABS ─── */
function switchTab(btn, tabId, context) {
  const prefix = context === 'patient' ? 'p-' : 'r-';
  document.querySelectorAll(`[id^="tab-${prefix}"]`).forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tabId).classList.add('active');
  btn.closest('.tab-bar').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function switchTabById(tabId, context) {
  const prefix = context === 'patient' ? 'p-' : 'r-';
  document.querySelectorAll(`[id^="tab-${prefix}"]`).forEach(el => el.classList.remove('active'));
  const target = document.getElementById('tab-' + tabId);
  if (target) target.classList.add('active');
  document.querySelectorAll(`[data-tab="${tabId}"]`).forEach(b => {
    b.closest('.tab-bar').querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
  });
}

/* ─── MODAL ─── */
function openModal() {
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('modalBox').classList.add('open');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.getElementById('modalBox').classList.remove('open');
}

/* ─── HELPERS ─── */
function toast(msg, type = 'info', duration = 4000) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  el.innerHTML = `<span class="toast-icon">${icon}</span><span>${msg}</span>`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), duration);
}

function showLoader(on) {
  document.getElementById('loader').classList.toggle('active', on);
}

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function getInitials(name) {
  return (name || '').replace('Dr. ', '').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function statusBadge(s) {
  const map = { Pending: 'badge-pending', Attended: 'badge-attended', Cancelled: 'badge-cancelled' };
  return `<span class="badge ${map[s] || 'badge-pending'}">${s}</span>`;
}

const DEPT_CLASSES = ['dept-0', 'dept-1', 'dept-2', 'dept-3', 'dept-4'];
function deptPill(dept) {
  const idx = STATE.departments.findIndex(d => d.name === dept) % 5;
  return `<span class="dept-pill ${DEPT_CLASSES[idx >= 0 ? idx : 0]}">${dept || '—'}</span>`;
}

function emptyRow(cols, msg) {
  return `<tr><td colspan="${cols}"><div class="empty-state"><div class="empty-icon">📭</div><p>${msg}</p></div></td></tr>`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
