from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from pan_verification.pipeline import pan_pipeline_detailed
from passporteye import read_mrz
from PIL import Image
import pytesseract
import random, os, httpx, re, time, io
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(env_path)
load_dotenv()

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
FROM_EMAIL = os.getenv("FROM_EMAIL")

app = FastAPI(title="Verification API")

# Store OTP with timestamp: {email: {"otp": int, "timestamp": float}}
otp_store = {}
OTP_EXPIRY_MINUTES = 5

def is_valid_email(email: str) -> bool:
    """Basic email validation"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

@app.post("/verify/pan")
async def verify_pan(pan_image: UploadFile = File(...), pan_number: str = Form(None)):
    try:
        image_bytes = await pan_image.read()
        res = pan_pipeline_detailed(image_bytes, pan_number)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"verified": bool(res.get("verified", False))}

@app.post("/verify/pan_debug")
async def verify_pan_debug(pan_image: UploadFile = File(...), pan_number: str = Form(None)):
    try:
        image_bytes = await pan_image.read()
        res = pan_pipeline_detailed(image_bytes, pan_number)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return res

@app.post("/verify/passport")
async def verify_passport(passport_image: UploadFile = File(...)):
    """Extract and verify passport MRZ data"""
    try:
        # Read the uploaded file
        contents = await passport_image.read()
        image = Image.open(io.BytesIO(contents))

        # Try parsing directly with passporteye
        mrz = read_mrz(io.BytesIO(contents))

        if mrz is None:
            # fallback: use OCR text
            ocr_text = pytesseract.image_to_string(image)
            mrz = read_mrz(ocr_text.encode())

        if mrz is None:
            return {
                "verified": False,
                "error": "Could not extract MRZ from passport image",
                "mrz_data": None
            }

        mrz_data = mrz.to_dict()
        
        # Basic verification - check if required fields are present
        required_fields = ['surname', 'names', 'number', 'country', 'date_of_birth']
        verified = all(field in mrz_data and mrz_data[field] for field in required_fields)
        
        return {
            "verified": verified,
            "mrz_data": mrz_data,
            "extracted_info": {
                "full_name": f"{mrz_data.get('names', '')} {mrz_data.get('surname', '')}".strip(),
                "passport_number": mrz_data.get('number', ''),
                "country": mrz_data.get('country', ''),
                "nationality": mrz_data.get('nationality', ''),
                "date_of_birth": mrz_data.get('date_of_birth', ''),
                "expiry_date": mrz_data.get('expiry_date', ''),
                "sex": mrz_data.get('sex', '')
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing passport: {str(e)}")

@app.post("/submit-pan")
async def submit_pan(pan_image: UploadFile = File(...), pan_number: str = Form(...)):
    """Submit verified PAN information"""
    return {
        "msg": "PAN information submitted successfully", 
        "pan_number": pan_number.upper(),
        "status": "submitted"
    }

@app.post("/submit/passport")
async def submit_passport(passport_number: str = Form(...)):
    """Submit verified passport information"""
    return {
        "msg": "Passport information submitted successfully", 
        "passport_number": passport_number
    }

@app.post("/verify/email/send_otp")
async def send_email_otp(email: str):
    """Generate OTP and send it via SendGrid"""
    if not is_valid_email(email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    # For demo purposes, generate OTP without SendGrid if not configured
    otp = random.randint(100000, 999999)
    otp_store[email] = {
        "otp": otp,
        "timestamp": time.time()
    }

    # Try to send email if SendGrid is configured
    if SENDGRID_API_KEY and FROM_EMAIL:
        payload = {
            "personalizations": [{"to": [{"email": email}]}],
            "from": {"email": FROM_EMAIL},
            "subject": "Crocengine - Your OTP Code",
            "content": [{"type": "text/plain", "value": f"Your OTP for Crocengine verification is: {otp}\n\nThis OTP will expire in {OTP_EXPIRY_MINUTES} minutes."}],
        }

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.sendgrid.com/v3/mail/send",
                    headers={"Authorization": f"Bearer {SENDGRID_API_KEY}"},
                    json=payload,
                )
            
            if resp.status_code not in [200, 202]:
                print(f"Email send failed: {resp.text}")
                return {"msg": "OTP generated (email service unavailable)", "otp": otp}
        except Exception as e:
            print(f"Email send error: {e}")
            return {"msg": "OTP generated (email service unavailable)", "otp": otp}
        
        return {"msg": "OTP sent to email"}
    else:
        # Demo mode - return OTP in response
        print(f"📧 Demo Mode - OTP for {email}: {otp}")
        return {"msg": "OTP generated (demo mode)", "otp": otp}


@app.post("/verify/email/verify_otp")
async def verify_email_otp(email: str, otp: int):
    """Verify OTP"""
    if email not in otp_store:
        raise HTTPException(status_code=400, detail="No OTP sent for this email")
    
    stored_data = otp_store[email]
    current_time = time.time()
    
    # Check if OTP has expired
    if current_time - stored_data["timestamp"] > (OTP_EXPIRY_MINUTES * 60):
        del otp_store[email]
        raise HTTPException(status_code=400, detail="OTP has expired")
    
    # Check if OTP matches
    if stored_data["otp"] == otp:
        del otp_store[email]
        return {"verified": True}
    
    raise HTTPException(status_code=400, detail="Invalid OTP")


@app.post("/submit/email")
async def submit_email(email: str):
    """Submit verified email"""
    return {"msg": "Email submitted successfully", "email": email}