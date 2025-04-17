import os
import random
import time
from typing import Any, Dict

import google.generativeai as genai

from core.config import CONFIG


class LLMGemini:
    def __init__(self, temperature: float = 1, max_tokens: int = 200, top_p: float = 0.95, top_k: int = 50):
        """
        Initialize Gemini Pro with proper configuration

        Args:
            model_name: The Gemini model version to use
        """
        genai.configure(api_key=CONFIG.API_KEYS.GEMINI)

        self.model_name = CONFIG.LLM.MODEL

        # Base configuration
        self.base_config = genai.GenerationConfig(
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            max_output_tokens=max_tokens,
        )

        self.model = genai.GenerativeModel(model_name=self.model_name, generation_config=self.base_config)
        print(f"Successfully initialized Gemini model: {self.model_name}")

    def chat(
        self,
        prompt: str,
    ) -> Dict[str, Any]:
        """
        Generate response with dynamic token handling

        Args:
            prompt: The user input prompt
            max_new_tokens: Maximum number of tokens to generate
            temperature: Controls randomness (0.0-1.0)

        Returns:
            Dict containing response status and text
        """

        max_retries = 3

        for attempt in range(max_retries):
            try:
                response = self.model.generate_content(prompt)

                if not response.text:
                    return {
                        "status": "error",
                        "message": "Empty response received",
                        "response": "Could you please rephrase that?",
                    }

                return {
                    "status": "success",
                    "response": response.text.strip(),
                    "tokens_used": len(response.text.split()),  # Approximate token count
                }

            except Exception as e:
                print(f"[ERROR] Gemini API Error: {str(e)}")
                time.sleep(random.randint(10, 20))
        return {
            "status": "error",
            "message": "Failed to get chat completion.",
            "response": "I'm having trouble generating a response. Please try again later.",
        }
