from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
import bcrypt
import os
import json
from datetime import timedelta
from database import get_db, init_db

app = Flask(__name__, static_folder='../frontend', static_url_path='')
app.config['JWT_SECRET_KEY'] = 'mediflow-super-secret-key-2024'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=8)

CORS(app, resources={r"/api/*": {"origins": "*"}})
jwt = JWTManager(app)

# ─── SERVE FRONTEND ──────────────────────────────────────────────────────────
@app.route('/')
def serve_index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../frontend', path)

# ─── AUTH ─────────────────────────────────────────────────────────────────────
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    username = (data.get('username') or '').strip().lower()
    password = (data.get('password') or '').strip()
    role = data.get('role', '')

    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400

    db = get_db()
    user = db.execute(
        "SELECT * FROM users WHERE username=? AND role=?", (username, role)
    ).fetchone()
    db.close()

    if not user:
        return jsonify({'error': 'Invalid credentials or wrong role selected'}), 401

    if not bcrypt.checkpw(password.encode(), user['password_hash'].encode()):
        return jsonify({'error': 'Incorrect password'}), 401

    # Build identity payload
    identity = json.dumps({'id': user['id'], 'role': user['role'], 'username': user['username']})
    token = create_access_token(identity=identity)

    extra = {}
    if role == 'doctor':
        db = get_db()
        doc = db.execute(
            "SELECT d.*, dept.name as dept_name FROM doctors d JOIN departments dept ON d.department_id=dept.id WHERE d.user_id=?",
            (user['id'],)
        ).fetchone()
        db.close()
        if doc:
            extra = {'doctor_id': doc['id'], 'doctor_name': doc['name'], 'department': doc['dept_name'], 'room': doc['room']}

    return jsonify({
        'token': token,
        'user': {'id': user['id'], 'username': user['username'], 'role': user['role'], 'full_name': user['full_name']},
        **extra
    })

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    username = (data.get('username') or '').strip().lower()
    password = (data.get('password') or '').strip()
    full_name = (data.get('full_name') or '').strip()
    email = (data.get('email') or '').strip()
    phone = (data.get('phone') or '').strip()

    if not username or not password or not full_name:
        return jsonify({'error': 'Username, password, and full name are required'}), 400

    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    db = get_db()
    try:
        db.execute(
            "INSERT INTO users (username,password_hash,role,full_name,email,phone) VALUES (?,?,?,?,?,?)",
            (username, pw_hash, 'patient', full_name, email, phone)
        )
        db.commit()
        user = db.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
        identity = json.dumps({'id': user['id'], 'role': 'patient', 'username': user['username']})
        token = create_access_token(identity=identity)
        db.close()
        return jsonify({'token': token, 'user': {'id': user['id'], 'username': user['username'], 'role': 'patient', 'full_name': full_name}})
    except Exception as e:
        db.close()
        if 'UNIQUE' in str(e):
            return jsonify({'error': 'Username already taken'}), 400
        return jsonify({'error': str(e)}), 500

# ─── DEPARTMENTS & DOCTORS ────────────────────────────────────────────────────
@app.route('/api/departments', methods=['GET'])
def get_departments():
    db = get_db()
    depts = db.execute("SELECT * FROM departments ORDER BY name").fetchall()
    db.close()
    return jsonify([dict(d) for d in depts])

@app.route('/api/doctors', methods=['GET'])
def get_doctors():
    dept_id = request.args.get('department_id')
    db = get_db()
    if dept_id:
        rows = db.execute(
            "SELECT d.*, dept.name as department_name FROM doctors d JOIN departments dept ON d.department_id=dept.id WHERE d.department_id=? ORDER BY d.name",
            (dept_id,)
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT d.*, dept.name as department_name FROM doctors d JOIN departments dept ON d.department_id=dept.id ORDER BY dept.name, d.name"
        ).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/doctors/<int:doctor_id>/slots', methods=['GET'])
def get_doctor_slots(doctor_id):
    date = request.args.get('date')
    if not date:
        return jsonify({'error': 'date required'}), 400

    ALL_SLOTS = [
        '09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM',
        '12:00 PM','02:00 PM','02:30 PM','03:00 PM','03:30 PM','04:00 PM','04:30 PM'
    ]

    db = get_db()
    booked = db.execute(
        "SELECT time_slot FROM appointments WHERE doctor_id=? AND appointment_date=? AND status!='Cancelled'",
        (doctor_id, date)
    ).fetchall()
    db.close()

    booked_slots = [b['time_slot'] for b in booked]
    slots = [{'slot': s, 'available': s not in booked_slots} for s in ALL_SLOTS]
    return jsonify(slots)

# ─── APPOINTMENTS ─────────────────────────────────────────────────────────────
def _get_identity():
    raw = get_jwt_identity()
    return json.loads(raw)

@app.route('/api/appointments', methods=['GET'])
@jwt_required()
def get_appointments():
    identity = _get_identity()
    role = identity['role']
    db = get_db()

    base_query = '''
        SELECT a.*, d.name as doctor_name, d.room, dept.name as department
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        JOIN departments dept ON d.department_id = dept.id
    '''

    filters = []
    params = []

    if role == 'patient':
        filters.append("a.patient_id=?")
        params.append(identity['id'])
    elif role == 'doctor':
        doc = db.execute("SELECT id FROM doctors WHERE user_id=?", (identity['id'],)).fetchone()
        if not doc:
            db.close(); return jsonify([])
        filters.append("a.doctor_id=?")
        params.append(doc['id'])

    # Optional filters
    status = request.args.get('status')
    date = request.args.get('date')
    dept = request.args.get('department')
    search = request.args.get('search', '').lower()

    if status: filters.append("a.status=?"); params.append(status)
    if date: filters.append("a.appointment_date=?"); params.append(date)
    if dept: filters.append("dept.name=?"); params.append(dept)

    where = ("WHERE " + " AND ".join(filters)) if filters else ""
    rows = db.execute(f"{base_query} {where} ORDER BY a.appointment_date DESC, a.time_slot", params).fetchall()
    db.close()

    result = [dict(r) for r in rows]
    if search:
        result = [r for r in result if search in (r.get('patient_name','') + r.get('doctor_name','') + str(r.get('id',''))).lower()]
    return jsonify(result)

@app.route('/api/appointments', methods=['POST'])
@jwt_required()
def create_appointment():
    identity = _get_identity()
    data = request.get_json()

    required = ['doctor_id', 'patient_name', 'appointment_date', 'time_slot']
    for f in required:
        if not data.get(f):
            return jsonify({'error': f'{f} is required'}), 400

    db = get_db()
    # Conflict check
    conflict = db.execute(
        "SELECT id FROM appointments WHERE doctor_id=? AND appointment_date=? AND time_slot=? AND status!='Cancelled'",
        (data['doctor_id'], data['appointment_date'], data['time_slot'])
    ).fetchone()
    if conflict:
        db.close()
        return jsonify({'error': f"Slot {data['time_slot']} on {data['appointment_date']} is already booked for this doctor."}), 409

    booked_by = identity['role']
    patient_id = identity['id'] if identity['role'] == 'patient' else None

    db.execute('''
        INSERT INTO appointments
        (patient_id, doctor_id, patient_name, patient_age, patient_sex, patient_phone, reason,
         appointment_date, time_slot, status, booked_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ''', (
        patient_id, data['doctor_id'], data['patient_name'],
        data.get('patient_age',''), data.get('patient_sex',''),
        data.get('patient_phone',''), data.get('reason',''),
        data['appointment_date'], data['time_slot'], 'Pending', booked_by
    ))
    db.commit()
    appt_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    appt = db.execute('''
        SELECT a.*, d.name as doctor_name, d.room, dept.name as department
        FROM appointments a
        JOIN doctors d ON a.doctor_id=d.id
        JOIN departments dept ON d.department_id=dept.id
        WHERE a.id=?
    ''', (appt_id,)).fetchone()
    db.close()
    return jsonify(dict(appt)), 201

@app.route('/api/appointments/<int:appt_id>', methods=['PUT'])
@jwt_required()
def update_appointment(appt_id):
    identity = _get_identity()
    data = request.get_json()
    db = get_db()

    appt = db.execute("SELECT * FROM appointments WHERE id=?", (appt_id,)).fetchone()
    if not appt:
        db.close(); return jsonify({'error': 'Not found'}), 404

    # Permission
    if identity['role'] == 'patient' and appt['patient_id'] != identity['id']:
        db.close(); return jsonify({'error': 'Forbidden'}), 403

    # If changing slot/doctor/date — conflict check
    new_doctor = data.get('doctor_id', appt['doctor_id'])
    new_date = data.get('appointment_date', appt['appointment_date'])
    new_slot = data.get('time_slot', appt['time_slot'])

    if new_doctor != appt['doctor_id'] or new_date != appt['appointment_date'] or new_slot != appt['time_slot']:
        conflict = db.execute(
            "SELECT id FROM appointments WHERE doctor_id=? AND appointment_date=? AND time_slot=? AND status!='Cancelled' AND id!=?",
            (new_doctor, new_date, new_slot, appt_id)
        ).fetchone()
        if conflict:
            db.close()
            return jsonify({'error': f"Slot {new_slot} is already booked."}), 409

    db.execute('''
        UPDATE appointments SET
        doctor_id=?, patient_name=?, patient_age=?, patient_sex=?, patient_phone=?,
        reason=?, appointment_date=?, time_slot=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
    ''', (
        new_doctor, data.get('patient_name', appt['patient_name']),
        data.get('patient_age', appt['patient_age']), data.get('patient_sex', appt['patient_sex']),
        data.get('patient_phone', appt['patient_phone']), data.get('reason', appt['reason']),
        new_date, new_slot, appt_id
    ))
    db.commit()
    updated = db.execute('''
        SELECT a.*, d.name as doctor_name, d.room, dept.name as department
        FROM appointments a JOIN doctors d ON a.doctor_id=d.id JOIN departments dept ON d.department_id=dept.id
        WHERE a.id=?
    ''', (appt_id,)).fetchone()
    db.close()
    return jsonify(dict(updated))

@app.route('/api/appointments/<int:appt_id>/status', methods=['PATCH'])
@jwt_required()
def update_status(appt_id):
    identity = _get_identity()
    data = request.get_json()
    new_status = data.get('status')

    if new_status not in ['Pending', 'Attended', 'Cancelled']:
        return jsonify({'error': 'Invalid status'}), 400

    db = get_db()
    appt = db.execute("SELECT * FROM appointments WHERE id=?", (appt_id,)).fetchone()
    if not appt:
        db.close(); return jsonify({'error': 'Not found'}), 404

    # Patients can only cancel their own
    if identity['role'] == 'patient':
        if appt['patient_id'] != identity['id'] or new_status not in ['Cancelled']:
            db.close(); return jsonify({'error': 'Forbidden'}), 403

    db.execute("UPDATE appointments SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", (new_status, appt_id))
    db.commit()
    db.close()
    return jsonify({'success': True, 'status': new_status})

@app.route('/api/appointments/<int:appt_id>', methods=['DELETE'])
@jwt_required()
def delete_appointment(appt_id):
    identity = _get_identity()
    if identity['role'] not in ['receptionist']:
        return jsonify({'error': 'Forbidden'}), 403
    db = get_db()
    db.execute("DELETE FROM appointments WHERE id=?", (appt_id,))
    db.commit()
    db.close()
    return jsonify({'success': True})

# ─── STATS ────────────────────────────────────────────────────────────────────
@app.route('/api/stats', methods=['GET'])
@jwt_required()
def get_stats():
    identity = _get_identity()
    db = get_db()
    import datetime
    today = datetime.date.today().isoformat()

    if identity['role'] == 'patient':
        uid = identity['id']
        total = db.execute("SELECT COUNT(*) FROM appointments WHERE patient_id=?", (uid,)).fetchone()[0]
        pending = db.execute("SELECT COUNT(*) FROM appointments WHERE patient_id=? AND status='Pending'", (uid,)).fetchone()[0]
        attended = db.execute("SELECT COUNT(*) FROM appointments WHERE patient_id=? AND status='Attended'", (uid,)).fetchone()[0]
        db.close()
        return jsonify({'total': total, 'pending': pending, 'attended': attended})

    elif identity['role'] == 'doctor':
        doc = db.execute("SELECT id FROM doctors WHERE user_id=?", (identity['id'],)).fetchone()
        if not doc: db.close(); return jsonify({})
        did = doc['id']
        total = db.execute("SELECT COUNT(*) FROM appointments WHERE doctor_id=?", (did,)).fetchone()[0]
        today_pending = db.execute("SELECT COUNT(*) FROM appointments WHERE doctor_id=? AND appointment_date=? AND status='Pending'", (did, today)).fetchone()[0]
        attended = db.execute("SELECT COUNT(*) FROM appointments WHERE doctor_id=? AND status='Attended'", (did,)).fetchone()[0]
        db.close()
        return jsonify({'total': total, 'today_pending': today_pending, 'attended': attended})

    else:  # receptionist
        total = db.execute("SELECT COUNT(*) FROM appointments").fetchone()[0]
        pending = db.execute("SELECT COUNT(*) FROM appointments WHERE status='Pending'").fetchone()[0]
        today_count = db.execute("SELECT COUNT(*) FROM appointments WHERE appointment_date=? AND status='Pending'", (today,)).fetchone()[0]
        cancelled = db.execute("SELECT COUNT(*) FROM appointments WHERE status='Cancelled'").fetchone()[0]
        db.close()
        return jsonify({'total': total, 'pending': pending, 'today': today_count, 'cancelled': cancelled})

if __name__ == '__main__':
    init_db()
    print("🚀 MediFlow backend running on http://localhost:5000")
    app.run(debug=True, port=5000, host='0.0.0.0')
