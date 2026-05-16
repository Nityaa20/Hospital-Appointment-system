# 🏥 MediFlow — Smart Hospital Appointment System

A full-stack hospital appointment management system with separate portals for **Patients**, **Doctors**, and **Receptionists**.

# 📌 Overview
Managing hospital appointments manually leads to missed slots, double bookings, and zero transparency for patients. MediFlow solves this by providing a centralized, role-based appointment management platform where:
🧑‍⚕️ Patients can register, browse departments, select doctors, and book appointments
👨‍⚕️ Doctors can view their daily schedule and mark appointments as attended
🗂️ Receptionists can oversee and manage all bookings across the hospital

## 🚀 Quick Start

### Windows
```
Double-click: start_windows.bat
```

### Mac / Linux
```bash
chmod +x start_mac_linux.sh
./start_mac_linux.sh
```

Then open **http://localhost:5000** in your browser.

---

## 🔑 Demo Login Credentials

| Role         | Username     | Password |
|--------------|-------------|----------|
| Patient      | patient1    | 1234     |
| Reception    | reception   | 1234     |
| Doctor (Cardiology) | sharma | 1234  |
| Doctor (Neurology)  | khan   | 1234  |
| Doctor (Orthopedics)| gill   | 1234  |
| Doctor (Pediatrics) | alice  | 1234  |
| Doctor (Dermatology)| white  | 1234  |

All 25 doctor usernames = their last name in lowercase.

---

## 🏗️ Project Structure

```
mediflow/
├── backend/
│   ├── app.py              # Flask REST API
│   ├── database.py         # SQLite DB setup + seeding
│   ├── requirements.txt    # Python dependencies
│   └── mediflow.db         # SQLite database (auto-created)
├── frontend/
│   ├── index.html          # Main HTML
│   ├── styles/
│   │   └── main.css        # All styles
│   └── js/
│       ├── api.js          # API client
│       └── app.js          # Application logic
├── start_windows.bat
├── start_mac_linux.sh
└── README.md
```

---

## 🧑‍⚕️ Features

### Patient Portal
- Register new account or login
- Book appointments (select dept → doctor → date → available slot)
- Room number auto-assigned from database
- Double-booking prevention (slots show as "Booked" if taken)
- SMS confirmation toast with appointment ID
- View all personal appointments with filters
- Edit pending appointments
- Cancel pending appointments

### Doctor Portal
- Login by selecting department + name
- Personal profile card (name, dept, room)
- View full appointment schedule
- Filter by date and status
- Mark patients as "Attended"
- Stats: total patients, today's pending, attended count

### Receptionist Portal
- View all hospital appointments with advanced filters
- Register walk-in appointments (reflected in doctor dashboard instantly)
- Check doctor slot availability (visual slot grid with free/booked status)
- Cancel any appointment
- View detailed appointment modal
- Stats: total, pending, today's, cancelled

---

## 🛠️ Tech Stack

| Layer     | Technology              |
|-----------|------------------------|
| Backend   | Python 3 + Flask        |
| Database  | SQLite (via sqlite3)    |
| Auth      | JWT (flask-jwt-extended)|
| Passwords | bcrypt hashing          |
| Frontend  | HTML5 + CSS3 + Vanilla JS |
| Fonts     | Google Fonts (DM Sans)  |

---

## 📋 Departments & Doctors

| Department   | Doctors                                         | Rooms      |
|-------------|------------------------------------------------|------------|
| Cardiology  | Dr. Sharma, Dr. Verma, Dr. Iyer, Dr. Reddy, Dr. Gupta | 101–105 |
| Neurology   | Dr. Khan, Dr. Singh, Dr. Mehta, Dr. Joshi, Dr. Das    | 106–110 |
| Orthopedics | Dr. Gill, Dr. Kapoor, Dr. Malhotra, Dr. Bansal, Dr. Sethi | 111–115 |
| Pediatrics  | Dr. Alice, Dr. Bob, Dr. Charlie, Dr. Diana, Dr. Eve   | 116–120 |
| Dermatology | Dr. White, Dr. Black, Dr. Grey, Dr. Brown, Dr. Green  | 121–125 |

---

## ⚙️ Manual Setup (if scripts don't work)

```bash
cd backend
pip install flask flask-cors flask-jwt-extended bcrypt
python database.py   # Creates & seeds the DB
python app.py        # Starts server on port 5000
```

Then visit: http://localhost:5000

---

## 🔒 Security Notes

- Passwords are bcrypt-hashed (never stored in plain text)
- JWT tokens expire after 8 hours
- Role-based access control on all API endpoints
- Patients can only view/edit their own appointments
- Doctors can only view their own schedule

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| POST | /api/auth/register | Patient registration |
| GET | /api/departments | List all departments |
| GET | /api/doctors | List doctors (filter by dept) |
| GET | /api/doctors/:id/slots | Available slots for date |
| GET | /api/appointments | Get appointments (role-filtered) |
| POST | /api/appointments | Book new appointment |
| PUT | /api/appointments/:id | Update appointment |
| PATCH | /api/appointments/:id/status | Change status |
| GET | /api/stats | Dashboard statistics |

# 🚀 Future Improvements
📧 Email confirmation after booking
📱 Mobile app version (React Native)
🔔 Real-time notifications using WebSockets
📆 Google Calendar integration for doctors
☁️ Deploy to cloud (AWS / Render / Railway)
📊 Analytics dashboard with charts for hospital admin
