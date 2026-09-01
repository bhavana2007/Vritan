from sqlalchemy.orm import Session
from typing import List, Optional
from models import AuditLog
from schemas.audit_schema import AuditLogCreate

class AuditRepository:
    """
    Repository for persisting audit logs.
    Ensures all administrative actions and enterprise events are securely logged.
    """

    def __init__(self, db: Session):
        """
        Initializes the repository with a database session.
        
        Args:
            db (Session): The SQLAlchemy database session.
        """
        self.db = db

    def log_event(self, audit_in: AuditLogCreate) -> AuditLog:
        """
        Creates a new immutable audit log entry.
        
        Args:
            audit_in (AuditLogCreate): Data for the audit log.
            
        Returns:
            AuditLog: The persisted audit log.
        """
        db_audit = AuditLog(**audit_in.model_dump())
        self.db.add(db_audit)
        self.db.commit()
        self.db.refresh(db_audit)
        return db_audit

    def get_logs_by_organization(self, org_id: int, skip: int = 0, limit: int = 100) -> List[AuditLog]:
        """
        Retrieves audit logs scoped to a specific organization.
        
        Args:
            org_id (int): The organization ID.
            skip (int): Number of records to skip.
            limit (int): Maximum number of records to return.
            
        Returns:
            List[AuditLog]: The audit logs for the organization.
        """
        return self.db.query(AuditLog).filter(
            AuditLog.organization_id == org_id
        ).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()

    def get_log_by_event_id(self, event_id: str) -> Optional[AuditLog]:
        """
        Retrieves a single audit log by its unique, blockchain-ready event ID.
        
        Args:
            event_id (str): The unique string identifier for the event.
            
        Returns:
            Optional[AuditLog]: The audit log if found, else None.
        """
        return self.db.query(AuditLog).filter(AuditLog.event_id == event_id).first()
