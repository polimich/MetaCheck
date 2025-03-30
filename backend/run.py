import os
import sys

if __name__ == "__main__":
    try:
        import uvicorn
        from metacheck_common.config import config
    except ImportError as e:
        print(f"ERROR: Failed to import required modules: {e}")
        print("Make sure you're running this script with the correct Python environment.")
        print("Try activating the virtual environment with: source .venv/bin/activate")
        sys.exit(1)

    # Get port from environment variable or use default
    port = int(os.environ.get("PORT", 8082))
    
    # Enable more verbose debug logging if DEBUG is set
    debug = os.environ.get("DEBUG", "0") == "1"
    
    print(f"Starting FastAPI server on port {port}, debug mode: {'enabled' if debug else 'disabled'}")
    
    try:
        uvicorn.run(
            "metacheck.main:app",
            host="0.0.0.0",
            port=port,
            reload=True,
            log_config=config.LOGGING_CONFIG,
        )
    except Exception as e:
        print(f"ERROR: Failed to start server: {e}")
        sys.exit(1)
