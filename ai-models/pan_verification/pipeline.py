from .ocr import extract_fields
from .heuristics import heuristic_forgery_detector
from .validator import (
    validate_format,
    call_gov_api,
    surname_matches_pan,
    crosscheck_pan,
)

def _to_float(x):
    try:
        return float(x)
    except Exception:
        return x

def pan_pipeline_detailed(image_bytes: bytes, user_provided_pan: str = None):
    # Extract OCR fields
    ocr = extract_fields(image_bytes)
    pan_str = ocr.get("pan") or user_provided_pan
    ocr_conf = _to_float(ocr.get("confidence", 0.0))
    name_text = ocr.get("name")

    # Checks
    format_ok = validate_format(pan_str)
    forgery = heuristic_forgery_detector(image_bytes)
    gov = call_gov_api(pan_str)
    surname_ok = surname_matches_pan(pan_str, name_text)
    pan_cross_ok = crosscheck_pan(user_provided_pan, ocr.get("pan"))

    # Verification logic
    verified, reasons = True, []
    if not pan_str:
        verified = False
        reasons.append("ocr_failed")
    if not format_ok:
        verified = False
        reasons.append("format_invalid")
    if forgery.get("prob_fake", 0.0) > 0.0:
        verified = False
        reasons.append("heuristic_forgery")
    if gov is False:
        verified = False
        reasons.append("gov_reject")
    if pan_str and name_text and not surname_ok:
        verified = False
        reasons.append("surname_mismatch")
    if user_provided_pan and not pan_cross_ok:
        verified = False
        reasons.append("pan_mismatch")

    return {
        "verified": bool(verified),
        "reasons": reasons,
        "ocr": {
            "pan": ocr.get("pan"),
            "confidence": ocr_conf,
            "raw": ocr.get("raw", []),
            "name": name_text,
        },
        "format_ok": bool(format_ok),
        "surname_ok": surname_ok,
        "pan_cross_ok": pan_cross_ok,
        "forgery": {
            k: (
                _to_float(v)
                if not isinstance(v, dict)
                else {kk: _to_float(vv) for kk, vv in v.items()}
            )
            for k, v in forgery.items()
        },
        "gov": gov,
    }
