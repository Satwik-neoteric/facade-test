@echo off
echo Setting up Facade Studio (FastAPI version)...

echo Creating Python virtual environment...
python -m venv venv

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing dependencies...
pip install -r requirements.txt

echo Environment setup complete!
echo.
echo To start the application:
echo 1. Ensure you have .env file with necessary configuration
echo 2. Run: uvicorn app.main:app --reload --port 8000
echo.
echo Press any key to exit...
pause > nul
