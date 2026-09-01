from pydantic import BaseModel
from typing import Generic, TypeVar, Optional, Any
from datetime import datetime

T = TypeVar("T")

class APIResponse(BaseModel, Generic[T]):
    """
    Standardized API Response Wrapper.
    Ensures all frontend consumers receive a predictable data structure.
    """
    success: bool
    message: str
    data: Optional[T] = None
    timestamp: datetime
    request_id: Optional[str] = None

def success_response(data: Any = None, message: str = "Success", request_id: Optional[str] = None) -> dict:
    return {
        "success": True,
        "message": message,
        "data": data,
        "timestamp": datetime.utcnow().isoformat(),
        "request_id": request_id
    }

def error_response(message: str, request_id: Optional[str] = None) -> dict:
    return {
        "success": False,
        "message": message,
        "data": None,
        "timestamp": datetime.utcnow().isoformat(),
        "request_id": request_id
    }
