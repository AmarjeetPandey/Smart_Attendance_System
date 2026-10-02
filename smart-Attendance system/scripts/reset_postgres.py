"""Destructively reset the PostgreSQL public schema for a clean installation."""
from backend.main import SCHEMA, engine, ensure_integrity_constraints, hash_password
from sqlalchemy import text
import os

with engine.begin() as connection:
    connection.execute(text("DROP SCHEMA public CASCADE"))
    connection.execute(text("CREATE SCHEMA public"))
    for statement in SCHEMA.split(";"):
        if statement.strip():
            connection.execute(text(statement))
    ensure_integrity_constraints(connection)
    admin_username = os.getenv("ADMIN_USERNAME", "").strip()
    admin_password = os.getenv("ADMIN_PASSWORD", "")
    if not admin_username or not admin_password:
        raise RuntimeError("ADMIN_USERNAME and ADMIN_PASSWORD must be set")
    connection.execute(
        text("INSERT INTO admins (username, password) VALUES (:username, :password)"),
        {"username": admin_username, "password": hash_password(admin_password)},
    )
    organization = connection.execute(
        text("INSERT INTO organizations (name, slug) VALUES ('Default Organization', 'default') RETURNING id")
    ).mappings().first()
    connection.execute(
        text("INSERT INTO attendance_policies (organization_id) VALUES (:organization_id)"),
        {"organization_id": organization["id"]},
    )

print("PostgreSQL public schema reset successfully.")
print("All application tables were recreated and the configured admin account was seeded.")
