-- Store each teacher's course assignment together with its specific class.
-- Existing teacher_courses rows remain available as legacy assignments.

CREATE TABLE IF NOT EXISTS teacher_class_courses (
    teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    class_id INTEGER NOT NULL REFERENCES course_catalog(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES course_catalog(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (teacher_id, class_id, course_id)
);