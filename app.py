"""
Main entry point for the application - used by run-local.bat

This file simply imports the actual FastAPI application from the app package.
"""

# Import the app instance from the app package
from app.main import app

# This will be used by uvicorn when run with the command: uvicorn app:app --reload

# The app object is now available for import
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=True)
