import pytest
from routers.auth import normalize_phone_number

def test_normalize_indian_number_with_plus91():
    # +91 prefix
    assert normalize_phone_number("+917601010283") == "7601010283"
    
def test_normalize_indian_number_with_91():
    # 91 prefix without plus
    assert normalize_phone_number("917601010283") == "7601010283"
    
def test_normalize_indian_number_with_0():
    # 0 prefix (local standard)
    assert normalize_phone_number("07601010283") == "7601010283"
    
def test_normalize_indian_number_without_prefix():
    # No prefix, exactly 10 digits
    assert normalize_phone_number("7601010283") == "7601010283"
    
def test_normalize_indian_number_with_spaces_and_dashes():
    # Extraneous characters
    assert normalize_phone_number("+91 760-101-0283") == "7601010283"
    assert normalize_phone_number("(+91) 760 101 0283") == "7601010283"

def test_normalize_rejects_invalid_lengths():
    with pytest.raises(ValueError, match="Invalid phone number length"):
        normalize_phone_number("12345")  # Too short
        
    with pytest.raises(ValueError, match="Invalid phone number length"):
        normalize_phone_number("1234567890123")  # Too long, not a standard prefix
        
def test_normalize_rejects_empty():
    with pytest.raises(ValueError, match="Phone number is required"):
        normalize_phone_number(None)
        
    with pytest.raises(ValueError, match="Phone number is required"):
        normalize_phone_number("")
