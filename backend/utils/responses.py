from datetime import datetime
from typing import Any, Optional
from fastapi.responses import JSONResponse

def success_response(data: Any = None, message: str = "Success") -> dict:
    return {
        "success": True,
        "message": message,
        "timestamp": datetime.utcnow().isoformat(),
        "data": data
    }

def error_response(message: str, error_code: str, status_code: int = 400, data: Optional[Any] = None) -> JSONResponse:
    content = {
        "success": False,
        "message": message,
        "error_code": error_code,
        "timestamp": datetime.utcnow().isoformat(),
        "data": data
    }
    return JSONResponse(status_code=status_code, content=content)
