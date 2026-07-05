from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from database import engine, get_db
from models import Base, Admin, MedicineMaster
from routers import admin as admin_router
from routers import auth as auth_router
from routers import prescriptions as prescriptions_router
from security import hash_password

from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
SIGNATURE_DIR = UPLOAD_DIR / "signatures"
SIGNATURE_DIR.mkdir(parents=True, exist_ok=True)

Base.metadata.create_all(bind=engine)


def bootstrap_admin():
    """Create default admin account if none exists."""
    with Session(engine) as db:
        admin_count = db.query(Admin).count()
        if admin_count == 0:
            print("ADMIN BOOTSTRAP - Creating default admin account")
            default_admin = Admin(
                email="medilockeradmin@gmail.com",
                password=hash_password("Admin@123"),
                is_active=True,
            )
            db.add(default_admin)
            db.commit()
            print("ADMIN CREATED - Default admin account created successfully")
            print("ADMIN CREDENTIALS - Email: medilockeradmin@gmail.com, Password: Admin@123")
        else:
            print("ADMIN EXISTS - Admin account already exists, skipping bootstrap")


bootstrap_admin()


def bootstrap_medicines():
    """Seed the database with a master list of medicines if empty."""
    with Session(engine) as db:
        if db.query(MedicineMaster).count() == 0:
            print("MEDICINES BOOTSTRAP - Seeding common medicines")
            common_meds = [
                {"name": "Paracetamol", "generic_name": "Paracetamol", "brand_name": "Crocin / Calpol", "default_strength": "650mg", "default_unit": "Tab", "default_route": "Oral"},
                {"name": "Amoxicillin", "generic_name": "Amoxicillin", "brand_name": "Augmentin", "default_strength": "625mg", "default_unit": "Tab", "default_route": "Oral"},
                {"name": "Metformin", "generic_name": "Metformin", "brand_name": "Glycomet", "default_strength": "500mg", "default_unit": "Tab", "default_route": "Oral"},
                {"name": "Atorvastatin", "generic_name": "Atorvastatin", "brand_name": "Lipitor", "default_strength": "10mg", "default_unit": "Tab", "default_route": "Oral"},
                {"name": "Amlodipine", "generic_name": "Amlodipine", "brand_name": "Amlong", "default_strength": "5mg", "default_unit": "Tab", "default_route": "Oral"},
                {"name": "Pantoprazole", "generic_name": "Pantoprazole", "brand_name": "Pan-40", "default_strength": "40mg", "default_unit": "Tab", "default_route": "Oral"},
                {"name": "Cetirizine", "generic_name": "Cetirizine", "brand_name": "Okacet", "default_strength": "10mg", "default_unit": "Tab", "default_route": "Oral"},
                {"name": "Ibuprofen", "generic_name": "Ibuprofen", "brand_name": "Brufen", "default_strength": "400mg", "default_unit": "Tab", "default_route": "Oral"},
            ]
            for med in common_meds:
                db.add(MedicineMaster(**med))
            db.commit()
            print("MEDICINES BOOTSTRAP - Seeding successful")


bootstrap_medicines()


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
        "confidence_score": "REAL NULL", # New column
        "ai_summary": "TEXT NULL",     # New column
    },
)
ensure_table_columns(
    "doctors",
    {
        "verification_status": "VARCHAR(20) NOT NULL DEFAULT 'pending'",
        "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "signature_image_url": "VARCHAR(255) NULL",
    },
)
ensure_table_columns(
    "patients",
    {
        "allergies": "TEXT NULL",
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

# Mount static file directories
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.include_router(auth_router.router)
app.include_router(admin_router.router)
app.include_router(prescriptions_router.router)


@app.get("/")
def home():
    return {"message": "MediLocker Backend Running Successfully"}
