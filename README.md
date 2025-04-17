# Suno Saarthi

**Suno Saarthi** is a lightweight, web‑based conversational navigation assistant powered by Google’s Gemini (LLM) and a FastAPI backend. Speak or type natural‑language navigation commands (e.g. “Navigate to India Gate”) and get turn‑by‑turn directions via a simple frontend interface.

---

## 📂 Repository Structure

```
.
├── .env                     # Environment variables (API keys)
├── backend                  # FastAPI server
│   ├── app.py               # Entry point
│   └── modules              # Core logic
│       ├── navigation.py    # Route‐lookup & directions logic
│       ├── llm_interface.py # Gemini API wrapper
│       └── wake_word.py     # Hotword detection
├── config                   # Settings & secrets
├── tests                    # Unit & integration tests
│   └── test_api.py
└── frontend                 # Static web app
    ├── index.html
    ├── css/
    ├── js/
    ├── includes/
    └── partials/
```

---

## 🚀 Features

- **Conversational UI**  
  Speak or type your destination in plain English (or Hindi, etc.).
- **LLM‑Powered**  
  Uses Gemini to interpret navigation intents and extract origin/destination.
- **Pluggable Navigation**  
  Stubbed-out navigation module ready for integration with real‑world Routes APIs (e.g. Google Maps).
- **Wake‑Word Detection**  
  Lightweight hotword (“Hey Saarthi”) listener for hands‑free operation.
- **Web Frontend**  
  Simple HTML/CSS/JS frontend for desktop and mobile browsers.

---

## ⚙️ Prerequisites

- **Python** 3.8 or higher  
- **pip** (Python package manager)  
- (Optional) **Virtual environment** tool (venv, virtualenv, Conda, etc.)  
- **Google Gemini API key**  
- **Google Maps (or equivalent) API key** (for real routing)

---

## 🛠️ Setup & Installation

1. **Clone the repository**  
   ```bash
   git clone https://github.com/regular-life/Suno-Saarthi.git
   cd Suno-Saarthi
   ```

2. **Create & activate a virtual environment**  
   ```bash
   python -m venv .venv
   # Linux/macOS
   source .venv/bin/activate
   # Windows (PowerShell)
   .venv\Scripts\Activate.ps1
   ```

3. **Install backend dependencies**  
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**  
   Copy the example `.env` and add your API keys:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` to include:  
   ```dotenv
   GEMINI_API_KEY=your_gemini_key_here
   MAPS_API_KEY=your_google_maps_key_here
   ```

---

## ▶️ Running the Project

### 1. Start the Backend Server

From the project root:
```bash
cd backend
python app.py
```
This will launch FastAPI on `http://localhost:8000`.  
You can explore the auto‑generated docs at `http://localhost:8000/docs`.

### 2. Start the Frontend Server

In a separate terminal:
```bash
cd frontend
python -m http.server 8080
```
Open your browser to `http://localhost:8080` to interact with Suno Saarthi.

---

## 🔜 To‑Do

- [ ] Integrate a real Routes API (e.g., Google Maps, Mapbox) in `navigation.py`  
- [ ] Refine LLM prompts and response handling in `modules/llm_interface.py`  
- [ ] Improve wake‑word detection accuracy and performance
<!-- - [ ] Turn frontend into a Progressive Web App (PWA)   -->
<!-- - [ ] Add user authentication & tighten CORS/security for production -->

Thinking of using "google-adk" with "google search tool" to fetch preferable response which requires user location.
LLM usage is currently faulty and needs to corrected/ improved.
PWA not functioning correctly right now. Does not take voice input from user (probably firefox or linux issue).

---
