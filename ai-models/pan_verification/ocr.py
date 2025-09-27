import easyocr, cv2, numpy as np, re

reader = easyocr.Reader(['en'], gpu=True)
PAN_REGEX = re.compile(r'^[A-Z]{5}[0-9]{4}[A-Z]$')

def _bytes_to_cv2(image_bytes):
    arr = np.frombuffer(image_bytes, np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)

def _enhance_for_ocr(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    eq = clahe.apply(gray)
    h,w = eq.shape
    if max(h,w) < 1000:
        eq = cv2.resize(eq, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    return eq

def _run_easyocr_on(img):
    if len(img.shape) == 2:
        rgb = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
    else:
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    results = reader.readtext(rgb)
    return [{'text': str(t).upper().strip(), 'conf': float(c)} for _, t, c in results]

def extract_fields(image_bytes: bytes):
    img = _bytes_to_cv2(image_bytes)
    if img is None:
        return {'pan': None, 'confidence': 0.0, 'raw': [], 'name': None}

    all_results = []
    all_results += _run_easyocr_on(img)
    enh = _enhance_for_ocr(img)
    all_results += _run_easyocr_on(enh)
    inv = 255 - enh
    all_results += _run_easyocr_on(inv)

    best_pan, best_conf = None, 0.0
    raw_list = []
    name_candidate = None

    for r in all_results:
        text = re.sub(r'[^A-Z0-9 ]', '', r['text'].upper())
        raw_list.append({'text': text, 'conf': float(r['conf'])})
        if PAN_REGEX.fullmatch(text) and r['conf'] > best_conf:
            best_pan, best_conf = text, r['conf']
        # crude name detector: long alphabetic string with no digits
        if not any(ch.isdigit() for ch in text) and len(text.split()) >= 2:
            if name_candidate is None or r['conf'] > name_candidate['conf']:
                name_candidate = {'text': text, 'conf': r['conf']}

    return {
        'pan': best_pan,
        'confidence': float(best_conf),
        'raw': raw_list,
        'name': name_candidate['text'] if name_candidate else None
    }
