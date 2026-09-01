import os
import uuid
import contextvars
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse
from schemas.response_schema import error_response
from utils.exceptions import DomainException

# Context var to hold the request ID globally
request_id_context_var = contextvars.ContextVar("request_id", default=None)

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Retrieve or generate request ID
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Set context var for non-request scopes (like services)
        token = request_id_context_var.set(request_id)
        
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            return response
        except Exception as exc:
            import traceback
            import sys
            
            exc_type, exc_value, exc_traceback = sys.exc_info()
            tb_str = "".join(traceback.format_exception(exc_type, exc_value, exc_traceback))
            
            print(f"[PATIENT_AUTH_AUDIT] Unhandled exception inside middleware execution: {exc}")
            print(f"[PATIENT_AUTH_AUDIT] Stack trace:\n{tb_str}")
            print(f"[PATIENT_AUTH_AUDIT] Request URL: {request.url}")
            print(f"[PATIENT_AUTH_AUDIT] Request headers: {dict(request.headers)}")
            
            return JSONResponse(
                status_code=500,
                content=error_response(message="An unexpected error occurred.", request_id=request_id)
            )
        finally:
            request_id_context_var.reset(token)

def get_current_request_id() -> str:
    """Helper to get current request ID from context."""
    return request_id_context_var.get()

async def domain_exception_handler(request: Request, exc: DomainException):
    """Global exception handler for all DomainExceptions to format standard API responses."""
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response(message=exc.detail, request_id=request_id)
    )

async def generic_exception_handler(request: Request, exc: Exception):
    """Fallback exception handler to format standard API responses."""
    request_id = getattr(request.state, "request_id", None)
    
    if os.getenv("APP_ENV", "development").lower() != "production":
        import traceback
        tb = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
        print(f"[PATIENT_AUTH_AUDIT] Generic exception handler caught: {exc}\n{tb}")
        
    return JSONResponse(
        status_code=500,
        content=error_response(message="An unexpected error occurred.", request_id=request_id)
    )

