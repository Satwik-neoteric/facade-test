import os
import uvicorn

# Check if running from the main directory or from the app module
if os.path.exists("app/main.py"):
    # Running from main directory
    print("Running from main directory...")
    from app.main import app
else:
    # Running from app module
    print("Running from app module...")
    try:
        from app.main import app
    except ImportError:
        raise ImportError("Could not import 'main'. Make sure 'main.py' exists in the current directory or adjust the import path.")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, reload=True)
