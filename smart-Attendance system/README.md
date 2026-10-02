# Smart Attendance System

Smart Attendance is a role-based attendance application with an admin, teacher, and student workspace.

## Stack

- Backend: FastAPI, Uvicorn, SQLAlchemy, psycopg, PostgreSQL
- Frontend: React, Vite
- Authentication: signed session cookie and PBKDF2-SHA256 password hashes
- Attendance methods: manual, QR, and browser face recognition
- Styling: role-specific CSS themes

## Requirements

- Python 3.11+
- Node.js 18+
- PostgreSQL
- A project virtual environment at `venv`

## Configuration

Create `.env` from `.env.example` and set a real PostgreSQL URL and secret values locally. Never commit `.env` or production credentials.

Important settings:

- `DATABASE_URL`
- `SECRET_KEY`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `FRONTEND_ORIGIN`
- `ATTENDANCE_BASE_URL`
- `SESSION_HTTPS_ONLY=1` when served only over HTTPS
- `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, and `DB_POOL_RECYCLE` for PostgreSQL pooling
- `QR_MAX_AGE_SECONDS` for QR expiry

The application is PostgreSQL-only. It rejects SQLite URLs at startup and does not read `attendance.db`; that file is a legacy local artifact and is ignored by Git.

## Run Locally

From the project root:

```powershell
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\Activate.ps1
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

For a clean restart that automatically removes an old backend process using port `8000`:

```powershell
.\scripts\start_backend.ps1
```

In a second terminal:

```powershell
cd frontend
npm install
npm run dev -- --host 127.0.0.1
```

The frontend can also be launched from the project root with:

```powershell
.\scripts\start_frontend.ps1
```

Open `http://127.0.0.1:5173/`. Backend health is available at `http://127.0.0.1:8000/api/health`, and API documentation is at `/docs`.

For local QR/camera HTTPS workflows, use `start_all.ps1` or `start_https.ps1` from an elevated PowerShell only when firewall/certificate installation is required.

## PostgreSQL Deployment

Create the production database first, then apply the migrations in order:

```powershell
psql $env:DATABASE_URL -f migrations/001_initial_postgresql.sql
psql $env:DATABASE_URL -f migrations/002_assignments_and_audit.sql
psql $env:DATABASE_URL -f migrations/003_production_controls.sql
psql $env:DATABASE_URL -f migrations/004_relational_exam_qr_courses.sql
psql $env:DATABASE_URL -f migrations/005_teacher_class_courses.sql
psql $env:DATABASE_URL -f migrations/006_attendance_subject.sql
```

Start the API with a process manager such as Gunicorn/Uvicorn workers or the hosting provider's process command:

```powershell
python -m uvicorn backend.main:api --host 0.0.0.0 --port 8000
```

Build the frontend and serve `frontend/dist` through the deployment platform or a reverse proxy. Set `FRONTEND_ORIGIN` to the deployed frontend origin and `ATTENDANCE_BASE_URL` to the public API URL.

Create a PostgreSQL backup on Windows with:

```powershell
.\scripts\backup_postgres.ps1
```

To intentionally erase all PostgreSQL application data and recreate a clean schema, first stop the API and run:

```powershell
$env:PYTHONPATH = (Get-Location).Path
.\venv\Scripts\python.exe .\scripts\reset_postgres.py
```

This destructive command keeps only the configured admin account, default organization, and default attendance policy. It cannot recover deleted rows.

The API provides an attendance CSV report at `/api/reports/attendance.csv` and in-app notifications at `/api/notifications`.

## Tests and Build

```powershell
.\venv\Scripts\python.exe -m unittest discover -s tests -v
cd frontend
npm run build
```

## Roles

- Admin: teachers, classes, student accounts, exam schedules, and teacher-course assignments
- Teacher: assigned class-course student directory, attendance, results, leave review, QR, and face enrollment
- Student: attendance, results, and leave requests

Teachers must be assigned to courses by an admin before they can manage students or attendance for those courses. Attendance changes are stored in `attendance_audit_logs`.
Attendance policies, notifications, organization seed data, and relational course links are applied by migrations `003_production_controls.sql` and `004_relational_exam_qr_courses.sql`, and automatically bootstrapped by the API for existing PostgreSQL databases.

## Database Changes

The application applies its current schema during startup for compatibility with the existing installation. The versioned migration for the new assignment and audit tables is also documented in `migrations/002_assignments_and_audit.sql`.

For production, run the SQL migration files against the same PostgreSQL database during deployment, then use a dedicated migration runner such as Alembic and disable ad-hoc startup schema changes after the migration history is established.

## Next Production Work

- Add full API integration tests and CI
- Move face-api model files from the CDN to a controlled local asset store
- Add liveness detection and explicit biometric consent/retention controls
- Add report export, notifications, backups, monitoring, and a production reverse proxy
- Split the large role workspace component into page and service modules
