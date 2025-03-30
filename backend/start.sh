#!/bin/bash
# Simple script to start the FastAPI app without VS Code
set -e  # Exit immediately if a command exits with a non-zero status

# Change to the script's directory
cd "$(dirname "$0")"

# Make sure virtual environment exists
if [ ! -d ".venv" ]; then
    echo "ERROR: Virtual environment not found at $(pwd)/.venv"
    echo "Please create a virtual environment first."
    exit 1
fi

# Activate virtual environment
echo "Activating virtual environment..."
source .venv/bin/activate

# Check if uvicorn is installed
if ! python -c "import uvicorn" &>/dev/null; then
    echo "ERROR: uvicorn not found in virtual environment."
    echo "Make sure to install requirements with: pip install -r requirements.txt"
    deactivate
    exit 1
fi

# Set environment variables
export PYTHONPATH="$(dirname "$PWD")"
export PORT=8082
export DEBUG=1

# Run the app
echo "Starting FastAPI server on port $PORT"
python run.py

# This will only run if the app exits normally
echo "Server stopped."
deactivate 