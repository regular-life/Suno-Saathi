# tests/test_llm_api.py
import os
import pytest
import google.generativeai as genai

from core.config import CONFIG

@pytest.mark.integration
def test_gemini_api_integration():
    """
    Quick smoke‑test that the real Gemini API is reachable and returns non‑empty text.
    Skips if no GEMINI_API_KEY is set in env or CONFIG.
    """
    # 1) Grab your real key (env var overrides CONFIG if you like)
    api_key = os.getenv("GEMINI_API_KEY") or CONFIG.API_KEYS.GEMINI
    if not api_key or api_key == "": 
        pytest.skip("No Gemini API key configured; skipping integration test")

    # 2) Configure the library for real
    genai.configure(api_key=api_key)

    # 3) Instantiate the model with minimal tokens so you don’t rack up billable usage
    model_name = CONFIG.LLM.MODEL
    generation_config = genai.GenerationConfig(
        temperature=0.0,
        top_p=0.95,
        top_k=1,
        max_output_tokens=10,
    )
    model = genai.GenerativeModel(model_name=model_name,
                                  generation_config=generation_config)

    # 4) Ask a trivial prompt
    prompt = "Hello, what's your name?"
    response = model.generate_content(prompt)

    # 5) Assert you got back some text
    assert hasattr(response, "text"), "No `.text` attribute on response"
    assert response.text.strip(), f"Empty response from Gemini for prompt: {prompt!r}"
    # Optionally: print it so you can eyeball
    print("Gemini replied:", response.text.strip())
