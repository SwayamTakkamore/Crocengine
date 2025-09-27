@echo off
echo Starting Email Verification API...
echo.
echo Make sure you have installed dependencies:
echo pip install -r requirements.txt
echo.
echo Starting server on http://127.0.0.1:8005
echo.
uvicorn api:app --host 127.0.0.1 --port 8005 --reload