-- Incremental schema migration for teacher-course permissions and attendance history.
-- The application startup also applies these statements for existing installations.

CREATE TABLE IF NOT EXISTS teacher_courses (
    teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES course_catalog(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (teacher_id, course_id)
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
