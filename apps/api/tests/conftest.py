import os, sys
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
from app.main import app
from app.database import Base, get_db
from app.services.jwt_service import issue_token


@pytest.fixture(scope="session")
def test_db_url():
    return os.environ.get("TEST_DATABASE_URL", "sqlite+pysqlite:///:memory:")


@pytest.fixture(scope="session")
def engine(test_db_url):
    engine = create_engine(test_db_url, connect_args={"check_same_thread": False} if test_db_url.startswith("sqlite") else {})
    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture(scope="function")
def db_session(engine):
    connection = engine.connect()
    txn = connection.begin()
    SessionTesting = sessionmaker(autocommit=False, autoflush=False, bind=connection)
    session = SessionTesting()
    yield session
    session.close()
    txn.rollback()
    connection.close()


@pytest.fixture(autouse=True)
def override_get_db(db_session):
    def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture()
def auth_address():
    return "0xabc1234567890000000000000000000000000001"


@pytest.fixture()
def auth_token(auth_address):
    return issue_token(auth_address)


@pytest.fixture()
def client(auth_token):
    return TestClient(app)


def auth_headers(token: str):
    return {"Authorization": f"Bearer {token}"}
