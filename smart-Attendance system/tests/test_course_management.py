import os
import unittest

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/test")
from backend.main import hash_password, verify_password


class FastAPIBackendTests(unittest.TestCase):
    def test_password_hash_round_trip(self):
        encoded = hash_password("admin123")
        self.assertTrue(verify_password("admin123", encoded))
        self.assertFalse(verify_password("wrong", encoded))


if __name__ == "__main__":
    unittest.main()
