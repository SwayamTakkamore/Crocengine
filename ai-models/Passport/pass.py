from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from passporteye import read_mrz
from PIL import Image
import pytesseract
import io

app = FastAPI(title="Passport MRZ API")


@app.post("/passport/parse")
async def parse_passport(file: UploadFile = File(...)):
    try:
        # Read the uploaded file
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))

        # Try parsing directly with passporteye
        mrz = read_mrz(io.BytesIO(contents))

        if mrz is None:
            # fallback: use OCR text
            ocr_text = pytesseract.image_to_string(image)
            mrz = read_mrz(ocr_text.encode())

        if mrz is None:
            raise HTTPException(
                status_code=400, detail="Could not extract MRZ from image"
            )

        return JSONResponse(content={"status": "success", "mrz_data": mrz.to_dict()})

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# curl -X POST "http://127.0.0.1:8000/passport/parse" \
#pip install fastapi uvicorn python-multipart pillow pytesseract passporteye
#sudo apt install tesseract-ocr -y   # (Linux; needed for OCR engine)