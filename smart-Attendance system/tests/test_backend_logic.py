import os
import unittest
from datetime import date, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/test")

from backend.main import delete_admin_student, grade_for, hash_password, parse_date, reset_admin_data, teacher_student_scope, update_admin_student, verify_password


class BackendLogicTests(unittest.TestCase):
    def test_password_hash_round_trip(self):
        encoded = hash_password("admin123")
        self.assertTrue(verify_password("admin123", encoded))
        self.assertFalse(verify_password("wrong", encoded))

    def test_grade_boundaries(self):
        self.assertEqual(grade_for(90, 100), "A+")
        self.assertEqual(grade_for(80, 100), "A")
        self.assertEqual(grade_for(50, 100), "D")
        self.assertEqual(grade_for(49, 100), "F")

    def test_parse_date(self):
        self.assertEqual(parse_date("2026-09-22", "Attendance date"), date(2026, 9, 22))
        with self.assertRaises(Exception):
            parse_date("22/09/2026", "Attendance date")

    def test_teacher_scope_is_limited_to_assigned_classes(self):
        scope = teacher_student_scope()
        self.assertIn("teacher_class_courses", scope)
        self.assertIn("assigned_class.id = s.course_id", scope)
        self.assertIn("teacher_courses", scope)

    def test_teacher_result_scope_requires_assigned_subject(self):
        scope = teacher_student_scope(subject_column="r.subject")
        self.assertIn("assigned_class.id = s.course_id", scope)
        self.assertIn("assigned_course.name = r.subject", scope)
        self.assertNotIn("teacher_courses", scope)

    def test_teacher_reset_preserves_accounts_and_clears_dashboard_state(self):
        request = SimpleNamespace(session={"account_id": 1, "role": "admin", "login_at": datetime.now().timestamp()})
        connection = MagicMock()
        transaction = MagicMock()
        transaction.__enter__.return_value = connection

        with patch("backend.main.engine.begin", return_value=transaction):
            result = reset_admin_data(request, scope="teachers", confirmation="CLEAR")

        statements = [str(call.args[0]) for call in connection.execute.call_args_list]
        self.assertEqual(result, {"status": "cleared", "scope": "teachers"})
        self.assertTrue(any("DELETE FROM teacher_class_courses" in statement for statement in statements))
        self.assertTrue(any("DELETE FROM teacher_courses" in statement for statement in statements))
        self.assertTrue(any("UPDATE leave_requests SET teacher_id = NULL" in statement for statement in statements))
        self.assertFalse(any("DELETE FROM teachers" in statement for statement in statements))

    def test_student_reset_preserves_profiles_and_accounts(self):
        request = SimpleNamespace(session={"account_id": 1, "role": "admin", "login_at": datetime.now().timestamp()})
        connection = MagicMock()
        transaction = MagicMock()
        transaction.__enter__.return_value = connection

        with patch("backend.main.engine.begin", return_value=transaction):
            result = reset_admin_data(request, scope="students", confirmation="CLEAR")

        statements = [str(call.args[0]) for call in connection.execute.call_args_list]
        self.assertEqual(result, {"status": "cleared", "scope": "students"})
        for table in ("attendance_audit_logs", "attendance", "results", "student_faces", "leave_requests"):
            self.assertTrue(any(f"DELETE FROM {table}" in statement for statement in statements))
        self.assertFalse(any("DELETE FROM students" in statement for statement in statements))
        self.assertFalse(any("DELETE FROM student_accounts" in statement for statement in statements))

    def test_admin_can_update_student_profile_and_login(self):
        request = SimpleNamespace(session={"account_id": 1, "role": "admin", "login_at": datetime.now().timestamp()})
        connection = MagicMock()
        transaction = MagicMock()
        transaction.__enter__.return_value = connection
        student = MagicMock()
        student.first.return_value = (42,)
        duplicates = MagicMock()
        duplicates.mappings.return_value.first.return_value = {"username_exists": False, "roll_exists": False, "registration_exists": False}
        class_row = MagicMock()
        class_row.mappings.return_value.first.return_value = {"id": 7, "name": "Class 7"}
        account = MagicMock()
        account.first.return_value = (42,)
        updated = MagicMock()
        updated.mappings.return_value.first.return_value = {"id": 42, "name": "New Name", "roll_number": "R42", "registration_number": "REG42", "course": "Class 7", "course_id": 7, "email": "student@example.com"}
        connection.execute.side_effect = [student, duplicates, class_row, account, updated, MagicMock()]

        with patch("backend.main.engine.begin", return_value=transaction):
            result = update_admin_student(request, 42, "New Name", "new-student-id", "R42", "REG42", 7, "student@example.com", "")

        statements = [str(call.args[0]) for call in connection.execute.call_args_list]
        self.assertEqual(result["username"], "new-student-id")
        self.assertTrue(any("UPDATE students SET name" in statement for statement in statements))
        self.assertTrue(any("UPDATE student_accounts SET username" in statement for statement in statements))

    def test_admin_can_delete_selected_student(self):
        request = SimpleNamespace(session={"account_id": 1, "role": "admin", "login_at": datetime.now().timestamp()})
        connection = MagicMock()
        transaction = MagicMock()
        transaction.__enter__.return_value = connection
        deleted = MagicMock()
        deleted.mappings.return_value.first.return_value = {"id": 42, "name": "Student Name"}
        connection.execute.return_value = deleted

        with patch("backend.main.engine.begin", return_value=transaction):
            result = delete_admin_student(request, 42)

        self.assertEqual(result, {"deleted": True, "id": 42, "name": "Student Name"})
        self.assertIn("DELETE FROM students WHERE id = :id", str(connection.execute.call_args.args[0]))


if __name__ == "__main__":
    unittest.main()
