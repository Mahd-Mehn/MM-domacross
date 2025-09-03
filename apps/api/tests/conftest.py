import os
import sys
import pytest

# Ensure the project root (containing the 'app' package) is on sys.path
CURRENT_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, os.pardir))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Ensure a clean database for the test session
from app.database import Base, engine  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def reset_database():
    # Drop and recreate all tables to avoid uniqueness conflicts across test runs
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
