from fastapi import FastAPI, HTTPException
import random, os, httpx, re, time
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from .env (look in parent directories)
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(env_path)
# Fallback: try loading from current directory and parent directories
load_dotenv()
load_dotenv('../.env')
load_dotenv('../../.env')
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
FROM_EMAIL = os.getenv("FROM_EMAIL")

app = FastAPI(title="Email Verification API")
# Store OTP with timestamp: {email: {"otp": int, "timestamp": float}}
otp_store = {}
OTP_EXPIRY_MINUTES = 5  # OTP expires in 5 minutes

def is_valid_email(email: str) -> bool:
    """Basic email validation"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


@app.post("/email/send_otp")
async def send_otp(email: str):
    """Generate OTP and send it via SendGrid"""
    # Validate email format
    if not is_valid_email(email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    # Check configuration
    if not SENDGRID_API_KEY or not FROM_EMAIL:
        raise HTTPException(status_code=500, detail="Missing SendGrid config")

    # Generate OTP and store with timestamp
    otp = random.randint(100000, 999999)
    otp_store[email] = {
        "otp": otp,
        "timestamp": time.time()
    }

    payload = {
        "personalizations": [{"to": [{"email": email}]}],
        "from": {"email": FROM_EMAIL},
        "subject": "Your OTP Code",
        "content": [{"type": "text/plain", "value": f"Your OTP is {otp}"}],
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={"Authorization": f"Bearer {SENDGRID_API_KEY}"},
            json=payload,
        )

    if resp.status_code not in [200, 202]:
        raise HTTPException(status_code=500, detail=f"Email send failed: {resp.text}")

    return {"msg": "OTP sent to email"}


@app.post("/email/verify_otp")
async def verify_otp(email: str, otp: int):
    """Verify OTP"""
    if email not in otp_store:
        raise HTTPException(status_code=400, detail="No OTP sent for this email")
    
    stored_data = otp_store[email]
    current_time = time.time()
    
    # Check if OTP has expired
    if current_time - stored_data["timestamp"] > (OTP_EXPIRY_MINUTES * 60):
        del otp_store[email]  # Clean up expired OTP
        raise HTTPException(status_code=400, detail="OTP has expired")
    
    # Check if OTP matches
    if stored_data["otp"] == otp:
        del otp_store[email]  # Clean up used OTP
        return {"verified": True}
    
    raise HTTPException(status_code=400, detail="Invalid OTP")


# curl -X POST "http://127.0.0.1:8005/email/send_otp?email=devanshpalsapure11@gmail.com"
# curl -X POST "http://127.0.0.1:8005/email/verify_otp?email=devanshpalsapure11@gmail.com&otp=490533"
