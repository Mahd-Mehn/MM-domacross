from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# Use DATABASE_URL from environment if available (for production), otherwise construct from individual settings
if hasattr(settings, 'database_url') and settings.database_url:
    SQLALCHEMY_DATABASE_URL = settings.database_url
else:
    SQLALCHEMY_DATABASE_URL = f"postgresql://{settings.postgres_user}:{settings.postgres_password}@{settings.postgres_host}:{settings.postgres_port}/{settings.postgres_db}"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# In local environment, create tables automatically so tests/dev don't require migrations.
# In production, tables should be created via migrations
if settings.app_env in ["local", "development"]:
    # Import models to register metadata
    from app.models import database as models  # noqa: F401
    Base.metadata.create_all(bind=engine)
elif settings.app_env == "production":
    # In production, ensure all models are imported for proper metadata registration
    from app.models import database as models  # noqa: F401

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
