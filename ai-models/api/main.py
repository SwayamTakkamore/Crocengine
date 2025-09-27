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

