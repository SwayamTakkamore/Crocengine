import re

PAN_REGEX = re.compile(r'^[A-Z]{5}[0-9]{4}[A-Z]$')

def validate_format(pan: str) -> bool:
    """Check if PAN follows standard format AAAAA9999A"""
    return bool(PAN_REGEX.fullmatch(pan.strip().upper())) if pan else False

def normalize_text(tok: str) -> str:
    """Keep only uppercase alphabets"""
    return re.sub(r'[^A-Z]', '', tok.upper()) if tok else ""

def surname_matches_pan(pan: str, ocr_name: str) -> bool:
    """
    Check if 5th char of PAN matches any initial in OCR'd name tokens.
    Works for 'First Middle Last' and 'Surname First' formats.
    """
    if not pan or not ocr_name:
        return False
    pan = pan.strip().upper()
    if not PAN_REGEX.fullmatch(pan):
        return False

    fifth_char = pan[4]

    # Split name into tokens (by space/comma)
    tokens = [normalize_text(t) for t in re.split(r'[ ,]', ocr_name) if t]
    tokens = [t for t in tokens if t]  # remove empties
    if not tokens:
        return False

    # Candidate initials = first letter of each token
    initials = {tok[0] for tok in tokens if tok}
    return fifth_char in initials

def crosscheck_pan(user_pan: str, ocr_pan: str) -> bool:
    """
    Cross-check PAN provided by user vs OCR-detected PAN.
    Returns True if both match, False otherwise.
    """
    if not user_pan or not ocr_pan:
        return False
    return user_pan.strip().upper() == ocr_pan.strip().upper()

# Govt API stub: always return True for demo
def call_gov_api(pan_number: str):
    return True if pan_number else None
