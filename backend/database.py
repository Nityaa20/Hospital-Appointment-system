import sqlite3
import bcrypt
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'mediflow.db')

DEPARTMENTS = {
    "Cardiology":   [("Dr. Sharma", "sharma"), ("Dr. Verma", "verma"), ("Dr. Iyer", "iyer"), ("Dr. Reddy", "reddy"), ("Dr. Gupta", "gupta")],
    "Neurology":    [("Dr. Khan", "khan"), ("Dr. Singh", "singh"), ("Dr. Mehta", "mehta"), ("Dr. Joshi", "joshi"), ("Dr. Das", "das")],
    "Orthopedics":  [("Dr. Gill", "gill"), ("Dr. Kapoor", "kapoor"), ("Dr. Malhotra", "malhotra"), ("Dr. Bansal", "bansal"), ("Dr. Sethi", "sethi")],
    "Pediatrics":   [("Dr. Alice", "alice"), ("Dr. Bob", "bob"), ("Dr. Charlie", "charlie"), ("Dr. Diana", "diana"), ("Dr. Eve", "eve")],
    "Dermatology":  [("Dr. White", "white"), ("Dr. Black", "black"), ("Dr. Grey", "grey"), ("Dr. Brown", "brown"), ("Dr. Green", "green")]
}

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()

    # Users table
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('patient','doctor','receptionist')),
        full_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )''')

    # Departments table
    c.execute('''CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
    )''')

    # Doctors table
    c.execute('''CREATE TABLE IF NOT EXISTS doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        name TEXT NOT NULL,
        department_id INTEGER REFERENCES departments(id),
        room TEXT NOT NULL,
        specialization TEXT,
        available_days TEXT DEFAULT 'Mon,Tue,Wed,Thu,Fri'
    )''')

    # Appointments table
    c.execute('''CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER REFERENCES users(id),
        doctor_id INTEGER REFERENCES doctors(id),
        patient_name TEXT NOT NULL,
        patient_age TEXT,
        patient_sex TEXT,
        patient_phone TEXT,
        reason TEXT,
        appointment_date TEXT NOT NULL,
        time_slot TEXT NOT NULL,
        status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending','Attended','Cancelled')),
        booked_by TEXT DEFAULT 'patient',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )''')

    conn.commit()

    # Seed if empty
    row = c.execute("SELECT COUNT(*) FROM users").fetchone()
    if row[0] == 0:
        _seed(c)
        conn.commit()

    conn.close()
    print("✅ Database initialized")

def _seed(c):
    # Receptionist
    pw = bcrypt.hashpw(b"1234", bcrypt.gensalt()).decode()
    c.execute("INSERT INTO users (username,password_hash,role,full_name,email,phone) VALUES (?,?,?,?,?,?)",
              ("reception","1234","receptionist","Reception Staff","reception@mediflow.com","9999999999"))
    # Fix: hash properly
    pw_hash = bcrypt.hashpw("1234".encode(), bcrypt.gensalt()).decode()
    c.execute("UPDATE users SET password_hash=? WHERE username='reception'", (pw_hash,))

    # Demo patient
    pw_hash = bcrypt.hashpw("1234".encode(), bcrypt.gensalt()).decode()
    c.execute("INSERT INTO users (username,password_hash,role,full_name,email,phone) VALUES (?,?,?,?,?,?)",
              ("patient1", pw_hash, "patient", "Demo Patient", "patient@mediflow.com", "9876543210"))

    room_num = 101
    for dept_name, doctors in DEPARTMENTS.items():
        c.execute("INSERT OR IGNORE INTO departments (name) VALUES (?)", (dept_name,))
        dept_id = c.execute("SELECT id FROM departments WHERE name=?", (dept_name,)).fetchone()[0]
        for (dr_name, username) in doctors:
            pw_hash = bcrypt.hashpw("1234".encode(), bcrypt.gensalt()).decode()
            c.execute("INSERT INTO users (username,password_hash,role,full_name) VALUES (?,?,?,?)",
                      (username, pw_hash, "doctor", dr_name))
            user_id = c.lastrowid
            c.execute("INSERT INTO doctors (user_id,name,department_id,room) VALUES (?,?,?,?)",
                      (user_id, dr_name, dept_id, f"Room {room_num}"))
            room_num += 1

    print("✅ Database seeded with departments, doctors, receptionist, demo patient")

if __name__ == "__main__":
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    init_db()
