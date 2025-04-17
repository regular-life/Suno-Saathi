import google.generativeai as genai
import requests
from dotenv import load_dotenv
import os
from typing import Optional, Dict, Any, List
import json
from backend.config.secrets import GEMINI_API_KEY, LLM_MODEL

class GeminiLLM:
    def __init__(self, model_name: str = None):
        """
        Initialize Gemini Pro with proper configuration
        
        Args:
            model_name: The Gemini model version to use
        """
        api_key = GEMINI_API_KEY
        if not api_key:
            raise ValueError("Missing GEMINI_API_KEY in environment variables")
        genai.configure(api_key=api_key)

        # Use model name from parameters or from secrets
        self.model_name = model_name or LLM_MODEL or "gemini-pro"

        # Base configuration
        self.base_config = genai.GenerationConfig(
            temperature=1,
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

        try:
            self.model = genai.GenerativeModel(
                model_name=self.model_name,
                generation_config=self.base_config,
                safety_settings=self.safety_settings
            )
            print(f"Successfully initialized Gemini model: {self.model_name}")
        except Exception as e:
            print(f"Warning: Failed to initialize Gemini model: {e}")
            self.model = None
        
        self.default_context = """
        You are Suno Saarthi, a friendly and helpful AI co-passenger designed for Indian drivers. Your role is to provide:
        1. Safe, distraction-free navigation assistance
        2. Culturally-aware driving advice
        3. Natural mixed-language (Hindi-English) responses

        Core Principles:
        - Detect primary language from speech/text (Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi) and respond in this language.
        - Support language-switching patterns that mix well with locals and their specific language proficiency (e.g. Hindi users don't usually use terms like "kosh" for "km").
        - Always prioritize driver safety (never distract with long responses) in user's most proficient language.
        - Use simple, clear instructions with landmarks familiar to Indian drivers.
        - Support seamless code-switching (e.g., "Aage 500m par left lena" + "then take the flyover").
        - Be proactive but not intrusive.

        Response Guidelines:
        1. Navigation Mode:
        - Format: [Direction] + [Distance] + [Landmark] + [Lane Guidance]
        - Example: "Right lena 200m aage DMRC ke baad, left lane mein rahiye"

        2. Query Handling:
        - Traffic: "Yahan se 5 minute ka jam hai. Alternate route via MG Road?"
        - Landmarks: "Next petrol pump HP hai, 1.2km aage left side pe"
        - Hazards: "Slow down - speed breaker 50m aage"

        3. Cultural Nuances:
        - Use local terms: "service lane" instead of shoulder, "thela" for street vendors
        - Recognize Indian road behaviors: "Gaadi waale suddenly cut kar sakte hain"

        4. Personality Traits:
        - Helpful but concise
        - Mild humor when appropriate ("Abhi straight jaayein, bilkul apne saas ki tarah")
        - Reassuring in stressful situations ("Koi baat nahi, next U-turn se wapas chalein")

        Safety Protocols:
        - If query requires complex answer: "Baad mein batata hoon, abhi road pe dhyan dijiye"
        - For non-driving queries: "Ye sunn ke khush hue: [joke]. Ab back to driving!"

        Current Context:
        - Vehicle Type: {car/bike/truck} (adapt instructions accordingly)
        - Location: {urban/highway} (adjust landmark frequency)
        - Driver Preference: {detailed/concise} mode

        Example Interactions:
        User: "Flyover lena hai ya nahi?"
        Saarthi: "Haan, 800m aage flyover lena better hai. Right lane shift karein"

        User: "Shortcut pata hai?"
        Saarthi: "Haan, ek gali se shortcut hai lekin thoda congested ho sakta hai. Bataun?"

        User: "Bohot traffic hai!"
        Saarthi: "Samajh raha hoon. Next signal se left le lijiye, wahan kam jam hai"`
        
        Keep responses brief and focused on navigation when the user is driving.
        """

    def generate_reply(self, prompt: str, max_new_tokens: int = 200, 
                      temperature: float = 1, include_context: bool = True) -> Dict[str, Any]:
        """
        Generate response with dynamic token handling
        
        Args:
            prompt: The user input prompt
            max_new_tokens: Maximum number of tokens to generate
            temperature: Controls randomness (0.0-1.0)
            include_context: Whether to include the default assistant context
            
        Returns:
            Dict containing response status and text
        """
        if not self.model:
            return {
                "status": "error",
                "message": "Gemini model not initialized",
                "response": "I'm unable to generate a response at the moment."
            }
            
        try:
            # Create fresh config for each request
            current_config = genai.GenerationConfig(
                temperature=temperature,
                top_p=0.95,
                top_k=50,
                max_output_tokens=max_new_tokens
            )
            
            # Add context if requested
            full_prompt = self.default_context + "\n\nUser: " + prompt + "\nSaarthi:" if include_context else prompt

            response = self.model.generate_content(
                full_prompt,
                generation_config=current_config
            )

            if not response.text:
                return {
                    "status": "error",
                    "message": "Empty response received",
                    "response": "Could you please rephrase that?"
                }
                
            return {
                "status": "success",
                "response": response.text.strip(),
                "tokens_used": len(response.text.split())  # Approximate token count
            }

        except Exception as e:
            print(f"[ERROR] Gemini API Error: {str(e)}")
            return {
                "status": "error",
                "message": str(e),
                "response": "I'm having trouble connecting. Please try again later."
            }
    
    def process_navigation_prompt(self, user_query: str, 
                                navigation_context: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Process a navigation-related prompt with specific context
        
        Args:
            user_query: The user's navigation question
            navigation_context: Optional dict with current route, location, etc.
            
        Returns:
            Dict with response formatted for navigation
        """
        # Create a contextualized navigation prompt
        context = "You are navigating and need to provide clear, concise directions. "
        
        if navigation_context:
            if 'current_location' in navigation_context:
                context += f"Current location: {navigation_context['current_location']}. "
            if 'destination' in navigation_context:
                context += f"Destination: {navigation_context['destination']}. "
            if 'next_turn' in navigation_context:
                context += f"Next turn: {navigation_context['next_turn']}. "
            if 'distance_remaining' in navigation_context:
                context += f"Distance remaining: {navigation_context['distance_remaining']}. "
        
        context += "\nKeep your response under 15 words, focused on the immediate navigation need."
        
        full_prompt = context + f"\n\nUser asks: {user_query}\nNavigation response:"
        
        return self.generate_reply(full_prompt, max_new_tokens=150, temperature=1, include_context=False) 