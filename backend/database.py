import os
import sys
import re
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

# Load environment variables from .env file (no-op in production where env is injected)
load_dotenv()

# ── Database credential resolution ──────────────────────────────────────────
# Priority 1: a fully-formed DATABASE_URL  (standard Render / cloud pattern)
# Priority 2: individual DB_* variables    (local XAMPP / custom cloud)
# Priority 3: built-in defaults            (local XAMPP defaults only)
DATABASE_URL: str | None = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "3306")
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_NAME = os.getenv("DB_NAME", "medilocker")
    DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"


def mask_database_url(url: str) -> str:
    """Return the URL with the password replaced by ****."""
    try:
        if "@" in url and ":" in url.split("@")[0]:
            parts = url.split("@")
            prefix = parts[0]
            suffix = "@".join(parts[1:])
            scheme_user, _password = prefix.rsplit(":", 1)
            return f"{scheme_user}:****@{suffix}"
    except Exception:
        pass
    return url


# ── Environment detection ────────────────────────────────────────────────────
app_env = os.getenv("APP_ENV", "development").lower()
is_testing = (
    app_env == "test"
    or "pytest" in sys.modules
    or any("pytest" in arg for arg in sys.argv)
)

# ── Engine creation ──────────────────────────────────────────────────────────
if is_testing:
    # SQLite is only used in the automated test suite — never on Render.
    _test_url = "sqlite:///./test_vritan.db"
    engine = create_engine(_test_url, connect_args={"check_same_thread": False})
    print(f"DATABASE STARTUP: TEST mode — SQLite ({mask_database_url(_test_url)})")

else:
    # Determine a sensible connect timeout:
    #   • Cloud / Render databases can take a few seconds to accept the first
    #     connection, so we give them 30 s.
    #   • The caller can override via DB_CONNECT_TIMEOUT.
    _connect_timeout = int(os.getenv("DB_CONNECT_TIMEOUT", "30"))

    # pymysql passes connect_timeout through connect_args.
    # pool_pre_ping keeps stale connections from causing 500s after idle periods.
    try:
        engine = create_engine(
            DATABASE_URL,
            connect_args={"connect_timeout": _connect_timeout},
            pool_pre_ping=True,
            pool_recycle=1800,   # recycle connections every 30 min
        )
        # Verify the connection is actually reachable at startup.
        with engine.connect() as _conn:
            pass
        print(
            f"DATABASE STARTUP: {app_env.upper()} mode — MySQL/MariaDB "
            f"({mask_database_url(DATABASE_URL)})"
        )
    except Exception as exc:
        _masked = mask_database_url(DATABASE_URL)
        print(
            f"CRITICAL DATABASE STARTUP ERROR: cannot connect to {_masked}. "
            f"Error: {exc}",
            file=sys.stderr,
        )
        raise RuntimeError(
            f"Database connection failed for MySQL at {_masked}. "
            "Set DATABASE_URL (or DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME) "
            "to a reachable cloud MySQL instance."
        ) from exc


# ── UTC timezone enforcement (MySQL/MariaDB only) ───────────────────────────
@event.listens_for(engine, "connect")
def _set_utc_timezone(dbapi_conn, connection_record):  # noqa: ANN001
    try:
        with dbapi_conn.cursor() as cursor:
            cursor.execute("SET time_zone = '+00:00'")
    except Exception:
        pass


# ── Session factory ──────────────────────────────────────────────────────────
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()