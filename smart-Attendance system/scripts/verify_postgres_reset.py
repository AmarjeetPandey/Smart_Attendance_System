from backend.main import engine
from sqlalchemy import text

TABLES = [
    "admins", "teachers", "students", "student_accounts", "course_catalog",
    "teacher_courses", "teacher_class_courses", "attendance", "attendance_audit_logs", "exams",
    "results", "leave_requests", "student_faces", "qr_sessions",
    "organizations", "attendance_policies", "notifications",
]

with engine.connect() as connection:
    table_count = connection.execute(text("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")).scalar()
    print(f"DB driver: {engine.url.drivername}")
    print(f"Public table count: {table_count}")
    for table in TABLES:
        count = connection.execute(text(f"SELECT count(*) FROM {table}")).scalar()
        print(f"{table}: {count}")
