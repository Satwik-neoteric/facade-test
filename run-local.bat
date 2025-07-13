@echo off
call .\venv\Scripts\activate
python -m uvicorn app:app --reload --port 5000
