-- Initial PostgreSQL schema for a fresh production database.

CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    roll_number TEXT UNIQUE NOT NULL,
    registration_number TEXT UNIQUE NOT NULL,
    course TEXT NOT NULL,
    email TEXT DEFAULT '',
    registration_date DATE
);
CREATE TABLE IF NOT EXISTS teachers (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS course_catalog (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL DEFAULT 'Class',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS teacher_courses (
    teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES course_catalog(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (teacher_id, course_id)
);
CREATE TABLE IF NOT EXISTS student_accounts (
    id SERIAL PRIMARY KEY,
    student_id INTEGER UNIQUE NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Late')),
    method TEXT NOT NULL DEFAULT 'Manual',
    UNIQUE (student_id, attendance_date)
);
CREATE TABLE IF NOT EXISTS attendance_audit_logs (
    id SERIAL PRIMARY KEY,
    attendance_id INTEGER,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    method TEXT NOT NULL,
    changed_by_role TEXT NOT NULL,
    changed_by_id INTEGER,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS leave_requests (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS exams (
    id SERIAL PRIMARY KEY,
    course TEXT NOT NULL,
    subject TEXT NOT NULL,
    exam_date DATE NOT NULL,
    created_by INTEGER REFERENCES admins(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS results (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    exam_name TEXT NOT NULL,
    marks NUMERIC(6,2) NOT NULL CHECK (marks >= 0),
    total_marks NUMERIC(6,2) NOT NULL CHECK (total_marks > 0),
    grade TEXT NOT NULL DEFAULT '',
    UNIQUE (student_id, subject, exam_name)
);
CREATE TABLE IF NOT EXISTS student_faces (
    student_id INTEGER PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
    descriptor JSONB NOT NULL,
    face_url TEXT DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS qr_sessions (
    id SERIAL PRIMARY KEY,
    token_id TEXT UNIQUE NOT NULL,
    attendance_date DATE NOT NULL,
    course TEXT DEFAULT '',
    used BOOLEAN NOT NULL DEFAULT FALSE,
    used_by_student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
