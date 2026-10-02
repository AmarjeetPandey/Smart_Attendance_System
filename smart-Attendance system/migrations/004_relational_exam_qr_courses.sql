-- Replace legacy text-only exam and QR course references with PostgreSQL foreign keys.

ALTER TABLE exams ADD COLUMN IF NOT EXISTS course_id INTEGER;
ALTER TABLE qr_sessions ADD COLUMN IF NOT EXISTS course_id INTEGER;

UPDATE exams e SET course_id = c.id FROM course_catalog c WHERE e.course_id IS NULL AND e.course = c.name;
UPDATE qr_sessions q SET course_id = c.id FROM course_catalog c WHERE q.course_id IS NULL AND q.course = c.name;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exams_course_id_fkey') THEN
        ALTER TABLE exams ADD CONSTRAINT exams_course_id_fkey FOREIGN KEY (course_id) REFERENCES course_catalog(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qr_sessions_course_id_fkey') THEN
        ALTER TABLE qr_sessions ADD CONSTRAINT qr_sessions_course_id_fkey FOREIGN KEY (course_id) REFERENCES course_catalog(id) ON DELETE SET NULL;
    END IF;
END $$;
