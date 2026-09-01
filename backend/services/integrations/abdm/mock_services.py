import logging

logger = logging.getLogger(__name__)

class AbhaServiceMock:
    """
    Mock implementation of ABDM ABHA generation and linking APIs.
    Isolates external dependency from core Appointment business logic.
    """
    
    @staticmethod
    def verify_abha_id(abha_id: str) -> bool:
        logger.info(f"Mock verifying ABHA ID: {abha_id}")
        return True if abha_id else False

    @staticmethod
    def generate_abha_id(patient_demographics: dict) -> str:
        logger.info(f"Mock generating ABHA ID for {patient_demographics.get('name')}")
        return "14-XXXX-XXXX-XXXX"

class ConsentServiceMock:
    """
    Mock implementation for ABDM Consent Management.
    """
    @staticmethod
    def request_consent(abha_id: str, purpose: str) -> str:
        logger.info(f"Mock requesting consent for ABHA {abha_id}, Purpose: {purpose}")
        return "CONSENT_REQ_12345"
        
class FhirServiceMock:
    """
    Mock implementation for pushing records to ABDM EHR.
    """
    @staticmethod
    def push_prescription(abha_id: str, prescription_payload: dict) -> bool:
        logger.info(f"Mock pushing prescription to FHIR repository for {abha_id}")
        return True
