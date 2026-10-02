-- Store attendance separately for each subject on a given date.

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT '';
ALTER TABLE qr_sessions ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT '';
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_student_id_attendance_date_key;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'attendance_student_date_subject_key'
          AND conrelid = 'attendance'::regclass
    ) THEN
        ALTER TABLE attendance
            ADD CONSTRAINT attendance_student_date_subject_key
            UNIQUE (student_id, attendance_date, subject);
    END IF;
END $$;