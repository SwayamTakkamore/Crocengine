from PIL import Image, ImageChops
import cv2, numpy as np, io, tempfile, os

def blur_score(image_bytes: bytes):
    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    return float(cv2.Laplacian(img, cv2.CV_64F).var())

def ela_score(image_bytes: bytes):
    orig = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
    try:
        orig.save(tmp.name, 'JPEG', quality=90)
        resaved = Image.open(tmp.name)
        diff = ImageChops.difference(orig, resaved)
        stat = float(np.array(diff).astype(np.float32).mean())
    finally:
        tmp.close(); os.remove(tmp.name)
    return stat

def heuristic_forgery_detector(image_bytes: bytes):
    blur = blur_score(image_bytes)
    ela = ela_score(image_bytes)
    blur_ok = blur > 100
    ela_ok = ela < 80  # relaxed threshold
    prob_fake = 0.0 if (blur_ok and ela_ok) else 0.5
    return {
        "prob_fake": prob_fake,
        "details": {"blur": blur, "ela": ela, "blur_ok": blur_ok, "ela_ok": ela_ok}
    }
