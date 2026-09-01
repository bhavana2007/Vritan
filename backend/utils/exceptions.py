from fastapi import HTTPException, status

class DomainException(HTTPException):
    def __init__(self, detail: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(status_code=status_code, detail=detail)

class OrganizationNotFound(DomainException):
    def __init__(self):
        super().__init__(detail="Organization not found", status_code=status.HTTP_404_NOT_FOUND)

class BranchNotFound(DomainException):
    def __init__(self):
        super().__init__(detail="Branch not found", status_code=status.HTTP_404_NOT_FOUND)

class UnauthorizedOrganizationAccess(DomainException):
    def __init__(self):
        super().__init__(detail="You do not have permission to access this organization", status_code=status.HTTP_403_FORBIDDEN)

class MembershipAlreadyExists(DomainException):
    def __init__(self):
        super().__init__(detail="User is already a member of this organization", status_code=status.HTTP_409_CONFLICT)

class InvalidOrganizationType(DomainException):
    def __init__(self):
        super().__init__(detail="Invalid organization type provided", status_code=status.HTTP_400_BAD_REQUEST)

class InactiveOrganization(DomainException):
    def __init__(self):
        super().__init__(detail="This organization is currently inactive", status_code=status.HTTP_403_FORBIDDEN)

class OrganizationLimitExceeded(DomainException):
    def __init__(self):
        super().__init__(detail="Organization resource limits exceeded for current subscription", status_code=status.HTTP_402_PAYMENT_REQUIRED)
