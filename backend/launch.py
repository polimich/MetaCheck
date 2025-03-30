"""
Simple launcher script that can be run directly without VS Code extensions.
Run this with: python launch.py
"""
import os
import sys
import subprocess

def main():
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Path to the virtual environment's Python
    venv_python = os.path.join(script_dir, '.venv', 'bin', 'python')
    
    if not os.path.exists(venv_python):
        print(f"Python path {venv_python} not found!")
        print("Please create a virtual environment at backend/.venv")
        return 1
    
    # Set environment variables
    my_env = os.environ.copy()
    my_env['PYTHONPATH'] = os.path.dirname(script_dir)  # Set to project root
    my_env['PORT'] = '8082'
    my_env['DEBUG'] = '1'
    
    # Use subprocess to run the script with the virtual env python
    print(f"Starting FastAPI server using virtual environment at {venv_python}")
    
    try:
        # Execute run.py with the virtual environment's Python
        result = subprocess.run(
            [venv_python, os.path.join(script_dir, 'run.py')],
            env=my_env,
            cwd=script_dir
        )
        return result.returncode
    except Exception as e:
        print(f"Error starting server: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 