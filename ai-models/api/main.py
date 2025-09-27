from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from pan_verification.pipeline import pan_pipeline_detailed

app = FastAPI(title="Verification API")

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

@app.post("/verify/email/send_otp")
async def send_email_otp(email: str):
    """Generate OTP and send it via SendGrid"""
    if not SENDGRID_API_KEY or not FROM_EMAIL:
        raise HTTPException(status_code=500, detail="Missing SendGrid config")

    otp = random.randint(100000, 999999)
    otp_store[email] = otp

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


@app.post("/verify/email/verify_otp")
async def verify_email_otp(email: str, otp: int):
    """Verify OTP"""
    if otp_store.get(email) == otp:
        return {"verified": True}
    raise HTTPException(status_code=400, detail="Invalid OTP")