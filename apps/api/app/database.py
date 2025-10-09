from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# Use DATABASE_URL from environment if available (for production), otherwise construct from individual settings
if hasattr(settings, 'database_url') and settings.database_url:
    SQLALCHEMY_DATABASE_URL = settings.database_url
else:
    SQLALCHEMY_DATABASE_URL = f"postgresql://{settings.postgres_user}:{settings.postgres_password}@{settings.postgres_host}:{settings.postgres_port}/{settings.postgres_db}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,  # Verify connections before using them
    pool_size=10,  # Number of connections to maintain
    max_overflow=20,  # Additional connections when pool is full
    pool_recycle=3600,  # Recycle connections after 1 hour
    connect_args={
        "connect_timeout": 10,  # Connection timeout in seconds
        # Note: statement_timeout removed - not supported by Neon pooled connections
        # Use unpooled connection string or set timeout at query level if needed
    }
)
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
