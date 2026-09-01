from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime

class AuditLogBase(BaseModel):
    event_type: str = Field(..., description="Type of event, e.g. 'OrganizationCreated', 'DoctorAssigned'")
    entity_type: str = Field(..., description="Entity affected, e.g. 'Organization', 'Branch'")
    entity_id: str = Field(..., description="ID of the affected entity")
    action: str = Field(..., description="Detailed action description")
    status: Optional[str] = "SUCCESS"
    ip_address: Optional[str] = None
    organization_id: Optional[int] = None
    user_id: Optional[int] = None
    hash: Optional[str] = Field(None, description="Hash for future blockchain integration")

class AuditLogCreate(AuditLogBase):
    pass

class AuditLogResponse(AuditLogBase):
    id: int
    event_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
