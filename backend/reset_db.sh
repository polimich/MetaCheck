#!/bin/bash

# Set the script to exit immediately if any command fails
set -e

# Change to the backend directory
cd "$(dirname "$0")"

# Check if virtual environment exists
if [ -d ".venv" ]; then
    echo "Activating virtual environment..."
    source .venv/bin/activate
else
    echo "Virtual environment not found at .venv/"
    echo "Trying to find another virtual environment..."
    
    # Try to find any venv in parent directories
    VENV_PATH=$(find .. -maxdepth 2 -type d -name ".venv" -o -name "venv" | head -1)
    
    if [ -n "$VENV_PATH" ]; then
        echo "Found virtual environment at $VENV_PATH"
        source "$VENV_PATH/bin/activate"
    else
        echo "No virtual environment found. Running with system Python."
    fi
fi

# Add force flag if passed as an argument
FORCE_FLAG=""
if [ "$1" == "--force" ]; then
    FORCE_FLAG="--force"
fi

# Run the reset script
echo "Running database reset script..."
python reset_db.py $FORCE_FLAG

# Deactivate the virtual environment if it was activated
if [ -n "$VIRTUAL_ENV" ]; then
    deactivate
fi

echo "Database reset complete!" 