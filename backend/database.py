import os
from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# MySQL Database Configuration
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "medilocker")

# Construct MySQL connection URL
DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

import sys
import re

app_env = os.getenv("APP_ENV", "development").lower()
is_testing = app_env == "test" or "pytest" in sys.modules or any("pytest" in arg for arg in sys.argv)

def mask_database_url(url: str) -> str:
    try:
        if "@" in url and ":" in url.split("@")[0]:
            parts = url.split("@")
            prefix = parts[0]
            suffix = "@".join(parts[1:])
            scheme_user, password = prefix.rsplit(":", 1)
            return f"{scheme_user}:****@{suffix}"
    except Exception:
        pass
    return url

if is_testing:
    # SQLite fallback ONLY for test execution environments
    DATABASE_URL = "sqlite:///./test_vritan.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    print(f"DATABASE STARTUP: Running in TEST mode. Engine: SQLite. URL: {mask_database_url(DATABASE_URL)}")
else:
    try:
        engine = create_engine(DATABASE_URL, connect_args={"connect_timeout": 3})
        # Test connection
        with engine.connect() as conn:
            pass
        print(f"DATABASE STARTUP: Running in {app_env.upper()} mode. Engine: MySQL. URL: {mask_database_url(DATABASE_URL)}")
    except Exception as e:
        masked_url = mask_database_url(DATABASE_URL)
        print(f"CRITICAL DATABASE STARTUP ERROR: Failed to connect to MySQL database at {masked_url}. Error: {e}", file=sys.stderr)
        raise RuntimeError(f"Database connection failed for MySQL at {masked_url}. Fast startup failure triggered.") from e


@event.listens_for(engine, "connect")
def _set_utc_timezone(dbapi_conn, connection_record):
    try:
        with dbapi_conn.cursor() as cursor:
            cursor.execute("SET time_zone = '+00:00'")
    except Exception:
        pass


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()