import sys
import os
import unittest
import json
from fastapi.testclient import TestClient

# Add the parent directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Import the FastAPI app
from backend.app import app

class TestSunoSaarthiAPI(unittest.TestCase):
    """Test cases for Suno Saarthi API endpoints"""
    
    def setUp(self):
        """Set up test client"""
        self.client = TestClient(app)
    
    def test_root_endpoint(self):
        """Test root endpoint returns correct information"""
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["app"], "Suno Saarthi API")
        self.assertEqual(data["status"], "running")
    
    def test_health_check(self):
        """Test health check endpoint"""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("status", data)
        self.assertIn("api_keys", data)
        self.assertIn("timestamp", data)
    
    def test_navigation_query(self):
        """Test navigation query endpoint"""
        payload = {
            "query": "Is there a flyover ahead?",
            "current_location": "Delhi"
        }
        response = self.client.post("/api/navigation/query", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("query_type", data)
        self.assertIn("response", data)
    
    def test_llm_generate(self):
        """Test LLM response generation"""
        payload = {
            "prompt": "How's the traffic?",
            "max_tokens": 50,
            "temperature": 0.7
        }
        response = self.client.post("/api/llm/generate", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("status", data)
        self.assertIn("response", data)
    
    def test_wake_word_detection(self):
        """Test wake word detection with text"""
        payload = {
            "text": "suno saarthi, how far is the destination?"
        }
        response = self.client.post("/api/wake/detect", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("detected", data)
        self.assertTrue(data["detected"])


if __name__ == "__main__":
    unittest.main() 