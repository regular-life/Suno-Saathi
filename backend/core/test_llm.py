# tests/test_llm.py
import pytest
import time
from unittest.mock import Mock

import core.config as config_module
from core.llm import LLMGemini

class DummyResponse:
    def __init__(self, text):
        self.text = text

@pytest.fixture(autouse=True)
def dummy_config(monkeypatch):
    """
    Override CONFIG.API_KEYS.GEMINI and CONFIG.LLM.MODEL
    so that LLMGemini.__init__ picks them up without touching real keys.
    """
    monkeypatch.setattr(config_module.CONFIG.API_KEYS, 'GEMINI', 'dummy_api_key')
    monkeypatch.setattr(config_module.CONFIG.LLM, 'MODEL', 'dummy_model')
    yield

@pytest.fixture
def stub_genai(monkeypatch):
    """
    Stub out google.generativeai.configure and GenerativeModel, returning
    a mocked model instance whose generate_content we can control.
    """
    # Stub configure()
    configure_mock = Mock()
    monkeypatch.setattr('google.generativeai.configure', configure_mock)

    # Stub GenerativeModel(...) -> model_instance
    model_instance = Mock()
    gm_ctor = Mock(return_value=model_instance)
    monkeypatch.setattr('google.generativeai.GenerativeModel', gm_ctor)

    return {
        'configure': configure_mock,
        'GM_ctor': gm_ctor,
        'model_instance': model_instance,
    }

def test_init_calls_configure_and_constructs_model(stub_genai):
    gemini = LLMGemini(temperature=0.7, max_tokens=100, top_p=0.8, top_k=40)

    # configure() called exactly once with our dummy key
    stub_genai['configure'].assert_called_once_with(api_key='dummy_api_key')

    # GenerativeModel() called exactly once
    stub_genai['GM_ctor'].assert_called_once()

    # Check that it was called with keyword args model_name and generation_config
    _, called_kwargs = stub_genai['GM_ctor'].call_args
    assert called_kwargs.get('model_name') == 'dummy_model'

    import google.generativeai as genai
    assert isinstance(called_kwargs.get('generation_config'), genai.GenerationConfig)

    # And gemini.model holds our stubbed instance
    assert gemini.model is stub_genai['model_instance']
    assert gemini.model_name == 'dummy_model'

def test_chat_success_returns_text_and_token_count(stub_genai):
    # make generate_content return a non-empty text
    stub_genai['model_instance'].generate_content.return_value = DummyResponse("hello world")
    gemini = LLMGemini()
    res = gemini.chat("Say hi")

    assert res['status'] == 'success'
    assert res['response'] == "hello world"
    # approximate tokens = number of words
    assert res['tokens_used'] == 2

def test_chat_empty_response_returns_error_and_prompt_rephrase(stub_genai):
    # simulate an empty string from generate_content
    stub_genai['model_instance'].generate_content.return_value = DummyResponse("")
    gemini = LLMGemini()
    res = gemini.chat("Anything")

    assert res['status'] == 'error'
    assert res['message'] == "Empty response received"
    assert res['response'] == "Could you please rephrase that?"

def test_chat_retries_and_eventually_errors_on_exceptions(stub_genai, monkeypatch):
    # simulate always-throw
    stub_genai['model_instance'].generate_content.side_effect = Exception("API is down")

    # speed up retries by no-op'ing sleep
    monkeypatch.setattr(time, 'sleep', lambda *_: None)

    gemini = LLMGemini()
    res = gemini.chat("Test failure")

    assert res['status'] == 'error'
    assert res['message'] == "Failed to get chat completion."
    assert "I'm having trouble generating a response" in res['response']

    # ensure we retried exactly max_retries (3) times
    assert stub_genai['model_instance'].generate_content.call_count == 3
