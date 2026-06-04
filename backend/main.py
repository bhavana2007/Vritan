from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from database import engine
from models import Base
from routers import auth as auth_router

from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

Base.metadata.create_all(bind=engine)


def ensure_table_columns(table_name: str, required_columns: dict[str, str]):
    inspector = inspect(engine)
    if table_name not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"] for column in inspector.get_columns(table_name)
    }
    missing_columns = [
        (name, definition)
        for name, definition in required_columns.items()
        if name not in existing_columns
    ]
    if not missing_columns:
        return

    alter_parts = [
        f"ADD COLUMN {name} {definition}" for name, definition in missing_columns
    ]
    with engine.begin() as connection:
        connection.execute(
            text(f"ALTER TABLE {table_name} {', '.join(alter_parts)}")
        )


ensure_table_columns(
    "medical_records",
    {
        "extracted_text": "TEXT NULL",
        "cleaned_text": "TEXT NULL",
        "detected_medicines": "TEXT NULL",
        "probable_conditions": "TEXT NULL",
        "ai_structured_data": "TEXT NULL",
    },
)
ensure_table_columns(
    "doctors",
    {
        "verification_status": "VARCHAR(20) NOT NULL DEFAULT 'pending'",
        "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    },
)
with engine.begin() as connection:
    connection.execute(
        text(
            "UPDATE doctors SET verification_status = 'approved' "
            "WHERE is_verified = TRUE AND verification_status = 'pending'"
        )
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)


@app.get("/")
def home():
    return {"message": "MediLocker Backend Running Successfully"}
