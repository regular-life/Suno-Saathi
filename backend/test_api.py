import requests
import json

# Base URL for the API
BASE_URL = "http://localhost:8000"

def test_root():
    """Test the root endpoint"""
    response = requests.get(f"{BASE_URL}/")
    print("Root endpoint:", response.status_code, response.json())

def test_health():
    """Test the health endpoint"""
    response = requests.get(f"{BASE_URL}/health")
    print("Health endpoint:", response.status_code, response.json())

def test_navigation_directions():
    """Test the navigation directions endpoint"""
    data = {
        "origin": "Delhi",
        "destination": "Mumbai"
    }
    response = requests.post(f"{BASE_URL}/api/navigation/directions", json=data)
    print("Navigation directions endpoint:", response.status_code)
    print(json.dumps(response.json(), indent=2))

def test_navigation_query():
    """Test the navigation query endpoint"""
    data = {
        "query": "Is there a flyover ahead?"
    }
    response = requests.post(f"{BASE_URL}/api/navigation/query", json=data)
    print("Navigation query endpoint:", response.status_code)
    print(json.dumps(response.json(), indent=2))

def test_llm_generate():
    """Test the LLM generate endpoint"""
    data = {
        "prompt": "How's the traffic?"
    }
    response = requests.post(f"{BASE_URL}/api/llm/generate", json=data)
    print("LLM generate endpoint:", response.status_code)
    print(json.dumps(response.json(), indent=2))

def test_wake_word_detection():
    """Test the wake word detection endpoint"""
    data = {
        "text": "suno saarthi, what's the weather today?"
    }
    response = requests.post(f"{BASE_URL}/api/wake/detect", json=data)
    print("Wake word detection endpoint:", response.status_code)
    print(json.dumps(response.json(), indent=2))

if __name__ == "__main__":
    print("Testing Suno Saarthi API...")
    test_root()
    test_health()
    test_navigation_directions()
    test_navigation_query()
    test_llm_generate()
    test_wake_word_detection()
    print("All tests completed.") 