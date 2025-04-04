import google.generativeai as genai
import requests
from dotenv import load_dotenv
import os
from typing import Optional
import json
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch


class TinyLlamaLLM:
    def __init__(self):
        model_id = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
        print("[INFO] Loading TinyLlama...")
        self.tokenizer = AutoTokenizer.from_pretrained(model_id)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_id,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        )
        self.model.eval()
        print("[INFO] TinyLlama loaded.")

    def generate_reply(self, prompt: str, max_new_tokens: int = 100) -> str:
        inputs = self.tokenizer(prompt, return_tensors="pt")
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                do_sample=True,
                top_k=50,
                temperature=0.8,
                top_p=0.95
            )
        response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        return response.replace(prompt, "").strip()


class DeepSeekLLM:
    def __init__(self):
        load_dotenv()
        self.api_key = os.getenv("DEEPSEEK_API_KEY")
        self.base_url = "https://api.deepseek.com/v1/chat/completions"
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json"
        }

    def generate_reply(self, prompt: str, max_new_tokens: int = 100) -> str:
        """
        Generates a response using DeepSeek's API with enhanced error handling
        and performance optimizations.
        """
        payload = {
            "model": "deepseek-chat",
            "messages": [{
                "role": "user",
                "content": prompt
            }],
            "temperature": 0.7,
            "max_tokens": max_new_tokens,
            "top_p": 0.9,
            "stream": False
        }

        try:
            response = requests.post(
                self.base_url,
                headers=self.headers,
                json=payload,
                timeout=10  # Added timeout for responsiveness
            )

            if response.status_code == 200:
                response_data = response.json()
                return response_data['choices'][0]['message']['content'].strip()

            print(
                f"[ERROR] API Request Failed: {response.status_code} - {response.text}")
            return "I'm having trouble connecting to the service. Please try again later."

        except requests.exceptions.RequestException as e:
            print(f"[ERROR] Network Error: {str(e)}")
            return "There was a network error. Please check your connection."
        except KeyError as e:
            print(f"[ERROR] Response Parsing Error: {str(e)}")
            return "I'm having trouble processing the response."
        except Exception as e:
            print(f"[ERROR] Unexpected Error: {str(e)}")
            return "Something went wrong. Please try again."


class GeminiLLM:
    def __init__(self):
        """Initialize Gemini Pro with proper configuration"""
        load_dotenv()
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("Missing GEMINI_API_KEY in environment variables")
        genai.configure(api_key=api_key)

        # Base configuration
        self.base_config = genai.GenerationConfig(
            temperature=0.8,
            top_p=0.95,
            top_k=50,
            max_output_tokens=100,
        )

        self.safety_settings = {
            'HATE': 'BLOCK_NONE',
            'HARASSMENT': 'BLOCK_NONE',
            'SEXUAL': 'BLOCK_NONE',
            'DANGEROUS': 'BLOCK_NONE'
        }

        self.model = genai.GenerativeModel(
            model_name='gemini-2.0-flash',
            generation_config=self.base_config,
            safety_settings=self.safety_settings
        )

    def generate_reply(self, prompt: str, max_new_tokens: int = 100) -> Optional[str]:
        """Generate response with dynamic token handling"""
        try:
            # Create fresh config for each request
            current_config = genai.GenerationConfig(
                temperature=0.8,
                top_p=0.95,
                top_k=50,
                max_output_tokens=max_new_tokens
            )

            response = self.model.generate_content(
                prompt,
                generation_config=current_config
            )

            return response.text.strip() if response.text else "Could you please rephrase that?"

        except Exception as e:
            print(f"[ERROR] Gemini API Error: {str(e)}")
            return "I'm having trouble connecting. Please try again later."


if __name__ == "__main__":
    # llm = DeepSeekLLM()
    llm = GeminiLLM()
    while True:
        test_prompt = input("User: ")
        print("Gemini: ", llm.generate_reply(test_prompt))
