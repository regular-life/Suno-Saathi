# Suno Saarthi Backend

This directory contains the backend API for Suno Saarthi, a conversational navigation assistant.

## Structure

The backend follows a modular architecture:

- `app.py`: Main FastAPI application with simplified API routes
- `test_api.py`: Script to test the API endpoints
- `pyproject.toml`: Project configuration and dependencies managed by Poetry
- `.pre-commit-config.yaml`: Pre-commit hooks configuration

## API Endpoints

### Navigation

- `POST /api/navigation/directions`: Get directions from origin to destination
- `POST /api/navigation/traffic`: Get traffic information
- `POST /api/navigation/places`: Find nearby places of interest
- `POST /api/navigation/query`: Process a natural language navigation query

### Wake Word

- `POST /api/wake/detect`: Detect wake word in text

## Setup

### Using Poetry (Recommended)

1. Install Poetry if you haven't already:
   ```bash
   pipx install poetry
   ```

2. Create and activate the virtual environment:
   ```bash
   cd backend
   poetry env use python3
   poetry install --with dev --no-root
   eval "$(poetry env activate)"
   ```

3. To add new packages:
   ```bash
   poetry add package-name
   ```

4. Set up pre-commit hooks:
   ```bash
   pre-commit install
   ```

### Using Traditional Virtual Environment

1. Create a virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Linux/macOS
   .venv\Scripts\activate     # On Windows
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Set up pre-commit hooks:
   ```bash
   pre-commit install
   ```

## Running the Backend

Run the FastAPI server:

```bash
cd backend
uvicorn app:app --reload
```

Access the API documentation at `http://localhost:8000/docs`

## Testing the API

A test script is provided to verify all endpoints are working:

```bash
cd backend
python tests/test_api.py
```