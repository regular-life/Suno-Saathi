# Suno Saarthi - Conversational Navigation Assistant

## Overview

Suno Saarthi is a voice-activated AI co-passenger designed to enhance the driving experience for Indian roads. It provides navigation assistance, responds to queries in a natural, mixed-language (Hindi-English) style, and prioritizes driver safety. This project demonstrates a baseline conversational loop with wake-word detection, basic NLP, and integration with a Large Language Model (LLM) for conversational responses.

## Features

*   **Wake-Word Detection:** Activates with "Suno Saarthi" (or variations).
*   **Voice Input:** Accepts voice commands using speech recognition.
*   **NLP Integration:** Uses Rasa for intent recognition and entity extraction.
*   **LLM Integration:** Leverages Gemini LLM for conversational responses.
*   **Route Query Handling:**  Recognizes route-related queries (flyover, shortcut, traffic) and provides placeholder responses.
*   **Mixed-Language Support:** Designed to handle code-switching between Hindi and English.


## Setup 

1. **Clone the repository**
    ```bash
    git clone https://github.com/regular-life/Suno-Saarthi
    ```
    OR
    **Download the zip and unzip it**

2. **Create a virtual environment (recommended):**
    ```bash
    python -m venv .venv
    source .venv/bin/activate  # On Linux/macOS
    .venv\Scripts\activate  # On Windows
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Set up Gemini API Key:** 
    Obtain a Gemini API key from the Google AI Studio ([https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)) and set it as environment variable named `GEMINI_API_KEY`:
    ```bash
    export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"  # Linux/macOS
    set GEMINI_API_KEY="YOUR_GEMINI_API_KEY"  # Windows
    ```
    Alternative to these commands, you can also directly create a `.env` and write:
    ```
    GEMINI_API_KEY="{YOUR_KEY}"
    ```

## Running the Project

1.  **Run the main script:**
    ```bash
    python main.py
    ```

2.  **Interact with Suno Saarthi:**
    *   Say "Suno Saarthi" (or "Hello") to activate the assistant.
    *   Speak your commands (e.g., "Navigate to India Gate", "What's the traffic like?").
    *   Say "quit", "exit", or "stop" to end the session.

## Demo Mode

For quick testing during evaluation, you can respond with "Hello" when prompted by the script instead of using the microphone. This bypasses the wake-word detection and allows you to directly input commands.

## To-Do

1. **Routes API:** 
    The navigation functionality is currently stubbed and requires integration with a **mapping API** (like Google Maps' Routes API).
2. **hard-coded `navigation.py`:** 
    Currently, the code is overall a bit hardcoded at few points, that needs to be resolved. (Post-direction access to the model.)
3. **Accurate voice detection and response integration:** 
    `Saarthi` is probably less used in the dataset on which the audiorecognizer is trained, hence there are issues with the model waking to the specific word.Need to use better trained, freely available model for this.
4. A **Progressive Web App (PWA)** seems a good option for the final product, as it clears pretty much all requirement.
5. **Refine Prompt:**
    Prompting in `main.py` may need more refining.

## Additional Points to note

1. Gemini is now being used as the main LLM for conversation. TinyLlama performed very poorly, and also required local downloading. Deepseek is paid API. Hence, not using it too.
