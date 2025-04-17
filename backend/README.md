# Suno Saarthi Backend

This directory contains the backend API for Suno Saarthi, a conversational navigation assistant.

## Structure

The backend follows a modular architecture:

- `app.py`: Main FastAPI application with simplified API routes
- `test_api.py`: Script to test the API endpoints
- `requirements.txt`: Minimal dependencies for running the API

## API Endpoints

### Navigation

- `POST /api/navigation/directions`: Get directions from origin to destination
- `POST /api/navigation/traffic`: Get traffic information
- `POST /api/navigation/places`: Find nearby places of interest
- `POST /api/navigation/query`: Process a natural language navigation query

### LLM

- `POST /api/llm/generate`: Generate a response using the LLM
- `POST /api/llm/navigation`: Process a navigation-related prompt with context

### Wake Word

- `POST /api/wake/detect`: Detect wake word in text

## Setup

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
python test_api.py
```

## Future Enhancements

The current implementation provides a simplified API with mock responses. Future enhancements will include:

1. Full integration with Google Maps API
2. LLM integration with Gemini
3. Wake word detection using audio input
4. Persistent route tracking
5. User authentication and preferences

## Notes for Python 3.13 Users

The simplified version is compatible with Python 3.13. If you encounter dependency issues with PyAudio, SpeechRecognition, or pydantic-core, consider:

1. Installing these packages through your system package manager
2. Using an older Python version (3.10-3.12) for development
3. Waiting for the packages to release Python 3.13 compatible versions 