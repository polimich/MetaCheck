# MetaCheck

Web application for checking and correcting bibliographic metadata that an AI tool extracted from scanned books and periodicals. My bachelor's thesis at the Faculty of Information Technology, Brno University of Technology (2025).

![A collection of scanned pages with confidence and verification status](docs/collection.png)

## Why it exists

Libraries and archives scan their collections at scale, but describing each document (title, author, publisher, volume, chapters) is still mostly manual work. MetaKat, a tool from the Smart Digilinka project, detects these elements on the page automatically. Its output still needs a person to confirm it, fix it and fill in what could not be detected. MetaCheck is the interface for that step.

## What it does

- Imports MetaKat JSON output together with the page scans and exports the corrected data back in the same format without losing information.
- Shows each detection as a box on the page, linked to its place in the document's bibliographic structure.
- Lets the user move, resize, relabel, add and delete detections on a canvas, with undo and redo.
- Sorts and filters pages by detection confidence and verification state, so low-confidence pages get checked first.
- Organises documents into collections with role-based access.

<img src="docs/annotator.png" alt="Detections drawn over a scanned title page" width="420">

## Stack

| Part | Technology |
|---|---|
| Frontend | Vue 3, TypeScript, Quasar, Pinia, Konva (canvas editor) |
| Backend | Python, FastAPI, SQLAlchemy 2 (async), Alembic, OpenCV |
| Database | PostgreSQL, with JSONB for the parts of the source format kept as-is |

The thesis covers the analysis of existing annotation tools, the data model, the system architecture, the user interface design, and testing with a sample of target users.

## Project Structure

- `frontend/` - Quasar/Vue.js frontend application
- `backend/` - FastAPI backend application
- `output_samples/` - Directory for output samples

## Prerequisites

- Python 3.x (for backend)
- Node.js 18+ (for frontend)
- PostgreSQL database
- Yarn package manager

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:

   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:

   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
   ```

3. Install Python dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Set up the database:

   - Create a PostgreSQL database
   - Configure the database connection in your environment variables or config file
   - Run database migrations:
     ```bash
     alembic upgrade head
     ```

5. Start the backend server:
   ```bash
   ./start.sh  # On Windows use: python run.py
   ```
   The backend will start on port 8082 by default.

### Frontend Setup

1. Navigate to the frontend directory:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   yarn
   ```

3. Start the development server:
   ```bash
   yarn dev
   ```
   The frontend development server will start and open in your default browser.

## Development

### Frontend Development

- Run `yarn lint` to lint the files
- Run `yarn format` to format the files
- Run `yarn build` to build for production

### Backend Development

- The backend uses FastAPI with SQLAlchemy for the ORM
- API documentation is available at `http://localhost:8082/docs` when the server is running
- Database migrations are managed with Alembic

## Features

- Metadata element management
- Collection handling
- Image processing and analysis
- Role-based access control
- RESTful API endpoints
- Modern responsive UI

## API Documentation

When the backend server is running, you can access:

- Swagger UI documentation: `http://localhost:8082/docs`
- ReDoc documentation: `http://localhost:8082/redoc`

When the frontend is running you can access it:

`http://localhost:9000`

## Environment Variables

The following environment variables can be configured to customize MetaCheck's behavior, see `backend/metacheck_common/config.py`:

| Variable                 | Description                       | Default Value                                                  |
| ------------------------ | --------------------------------- | -------------------------------------------------------------- |
| BASE_DIR                 | Base directory for all data       | ./metacheck_data                                               |
| ADMIN_SERVER_NAME        | Name for the admin server         | MetaCheck                                                      |
| SERVER_NAME              | Name for the main server          | MetaCheck                                                      |
| MODE                     | Application mode                  | server                                                         |
| DATABASE_URL             | PostgreSQL connection string      | postgresql+asyncpg://postgres:pass@localhost:5432/metacheck_db |
| APP_URL_ROOT             | Root URL path for the application | /                                                              |
| IMAGE_UPLOADED_DIR       | Directory for uploaded images     | {BASE_DIR}/server/image_uploaded                               |
| IMAGE_PREVIEW_DIR        | Directory for image previews      | {BASE_DIR}/server/image_preview                                |
| IMAGE_PREVIEW_RESOLUTION | Resolution for preview images     | 70000                                                          |
| WORKING_DIR              | Temporary working directory       | /tmp/metacheck.{MODE}                                          |
| PRODUCTION               | Production mode flag              | False                                                          |
| LOGGING_CONSOLE_LEVEL    | Console logging level             | INFO                                                           |
| LOGGING_FILE_LEVEL       | File logging level                | INFO                                                           |
| LOGGING_DIR              | Directory for log files           | {BASE_DIR}/{MODE}/logs                                         |

# License

MIT License

Copyright (c) [2025] [Michael Polívka]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
