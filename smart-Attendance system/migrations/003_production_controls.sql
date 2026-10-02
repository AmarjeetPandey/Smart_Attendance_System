-- Production controls: relational course links, tenant seed, policy, notifications.

CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance_policies (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    allow_future_dates BOOLEAN NOT NULL DEFAULT FALSE,
    max_backdate_days INTEGER NOT NULL DEFAULT 30,
    qr_valid_seconds INTEGER NOT NULL DEFAULT 86400,
    minimum_percentage NUMERIC(5,2) NOT NULL DEFAULT 75,
    UNIQUE (organization_id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER,
    recipient_role TEXT NOT NULL,
    recipient_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE students ADD COLUMN IF NOT EXISTS course_id INTEGER REFERENCES course_catalog(id) ON DELETE SET NULL;
INSERT INTO organizations (name, slug) VALUES ('Default Organization', 'default') ON CONFLICT (slug) DO NOTHING;
INSERT INTO attendance_policies (organization_id)
SELECT id FROM organizations WHERE slug = 'default'
ON CONFLICT (organization_id) DO NOTHING;
UPDATE students s SET course_id = c.id FROM course_catalog c WHERE s.course_id IS NULL AND s.course = c.name;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_course_id_fkey') THEN
        ALTER TABLE students ADD CONSTRAINT students_course_id_fkey FOREIGN KEY (course_id) REFERENCES course_catalog(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_requests_teacher_id_fkey') THEN
        ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_audit_logs_attendance_id_fkey') THEN
        ALTER TABLE attendance_audit_logs ADD CONSTRAINT attendance_audit_logs_attendance_id_fkey FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_organization_id_fkey') THEN
        ALTER TABLE notifications ADD CONSTRAINT notifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
    END IF;
END $$;
