import sys
import os

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from database import engine
from sqlalchemy import text
from datetime import datetime, timezone

def migrate():
    with engine.connect() as conn:
        print("Starting Branch Verification migration...")
        
        # 1. Count existing branches
        result = conn.execute(text("SELECT COUNT(*) FROM branches")).scalar()
        print(f"Branch count BEFORE migration: {result}")
        
        # 2. Add columns to branches table
        columns = [
            "verification_status VARCHAR(50) DEFAULT 'DOCUMENTS_REQUIRED'",
            "email_verified BOOLEAN DEFAULT FALSE",
            "email_verified_at DATETIME NULL",
            "email_verification_token VARCHAR(64) NULL",
            "submitted_for_review_at DATETIME NULL",
            "super_admin_approved BOOLEAN DEFAULT FALSE",
            "approved_by INTEGER NULL",
            "approved_at DATETIME NULL",
            "rejection_reason TEXT NULL",
            "correction_requested_at DATETIME NULL"
        ]
        
        for col in columns:
            col_name = col.split(" ")[0]
            try:
                # check if column exists
                conn.execute(text(f"SELECT {col_name} FROM branches LIMIT 1"))
                print(f"Column {col_name} already exists. Skipping.")
            except Exception:
                try:
                    print(f"Adding column {col_name}...")
                    conn.execute(text(f"ALTER TABLE branches ADD COLUMN {col}"))
                    conn.commit()
                except Exception as e:
                    print(f"Error adding column {col_name}: {e}")
                    
        # Add index for token and approved_by fk
        try:
            conn.execute(text("CREATE UNIQUE INDEX ix_branches_email_verification_token ON branches (email_verification_token)"))
            conn.commit()
            print("Added index for email_verification_token")
        except Exception:
            pass # might exist
            
        try:
            conn.execute(text("ALTER TABLE branches ADD CONSTRAINT fk_branches_approved_by FOREIGN KEY (approved_by) REFERENCES users (id)"))
            conn.commit()
            print("Added foreign key constraint for approved_by")
        except Exception:
            pass

        # 3. Migrate existing ACTIVE branches to APPROVED state
        try:
            print("Migrating existing ACTIVE branches to APPROVED state...")
            now_str = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
            result = conn.execute(text(
                f"""
                UPDATE branches 
                SET verification_status = 'APPROVED', 
                    super_admin_approved = 1,
                    email_verified = 1,
                    email_verified_at = '{now_str}',
                    approved_at = '{now_str}'
                WHERE status = 'ACTIVE' AND (verification_status IS NULL OR verification_status = 'DOCUMENTS_REQUIRED')
                """
            ))
            conn.commit()
            print(f"Updated {result.rowcount} existing branches.")
        except Exception as e:
            print(f"Error migrating existing branches: {e}")
            
        # 4. Create branch_documents table
        try:
            print("Creating branch_documents table...")
            conn.execute(text("""
            CREATE TABLE IF NOT EXISTS branch_documents (
                id INTEGER NOT NULL AUTO_INCREMENT, 
                branch_id INTEGER NOT NULL, 
                document_type VARCHAR(100) NOT NULL, 
                file_path VARCHAR(255) NOT NULL, 
                original_filename VARCHAR(255) NOT NULL, 
                uploaded_by INTEGER NOT NULL, 
                uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
                verification_status VARCHAR(50) DEFAULT 'PENDING', 
                verified_by INTEGER, 
                verified_at DATETIME, 
                rejection_reason TEXT, 
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id), 
                FOREIGN KEY(branch_id) REFERENCES branches (id) ON DELETE CASCADE, 
                FOREIGN KEY(uploaded_by) REFERENCES users (id), 
                FOREIGN KEY(verified_by) REFERENCES users (id)
            )
            """))
            conn.commit()
            print("Created branch_documents table.")
        except Exception as e:
            print(f"Error creating branch_documents table: {e}")

        # 5. Verify count after migration
        result_after = conn.execute(text("SELECT COUNT(*) FROM branches")).scalar()
        print(f"Branch count AFTER migration: {result_after}")
        
        if result == result_after:
            print("SUCCESS: Branch count matches.")
        else:
            print("ERROR: Branch count mismatch!")

if __name__ == "__main__":
    migrate()
