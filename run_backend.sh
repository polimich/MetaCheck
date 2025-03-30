#!/bin/bash
# Helper script to start the backend from the project root
set -e  # Exit immediately if a command exits with a non-zero status

echo "Starting MetaCheck backend..."

# Check if backend directory exists
if [ ! -d "backend" ]; then
    echo "ERROR: Backend directory not found at $(pwd)/backend"
    exit 1
fi

# Run the backend start script
cd backend
./start.sh 