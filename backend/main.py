import asyncio
import json
import os

# Add the parent directory to the path
import sys
import time
from typing import Any, Dict, Optional

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import settings
from core.config import CONFIG
from modules.llm_interface import GeminiLLM
from modules.navigation import NavigationHandler

# Import modules
from modules.wake_word import WakeWordDetector


class SunoSaarthiCore:
    """
    Core orchestration class for Suno Saarthi functionality.
    This class integrates wake word detection, LLM interaction, and navigation.
    """

    def __init__(self):
        """Initialize core components"""
        self.detector = WakeWordDetector(
            energy_threshold=CONFIG.WAKE_WORD.ENERGY_THRESHOLD,
            pause_threshold=CONFIG.WAKE_WORD.PAUSE_THRESHOLD,
            wake_words=CONFIG.WAKE_WORD.WORDS,
        )
        self.llm = GeminiLLM(model_name=CONFIG.LLM.MODEL)
        self.navigation = NavigationHandler()

        # Session state
        self.standby = True
        self.last_active_time = 0
        self.active_mode_timeout = 30  # seconds
        self.conversation_context = self._get_default_context()
        self.current_route = None
        self.current_location = None
        self.destination = None

    def _get_default_context(self) -> str:
        """Get default conversation context for the LLM"""
        return """
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
        """

    async def run_conversation_loop(self):
        """Main conversation loop for the assistant"""
        print("Initializing Suno Saarthi Core...")

        while True:
            try:
                if self.standby:
                    # Listen for wake word
                    recognized_text = self.detector.listen_for_wake_word()

                    # For demo purposes, also accept manual input
                    print('For demo purpose (respond with "Hello"):')
                    inp = input()

                    if self.detector.detect_wake_word(recognized_text) or inp.lower() == "hello":
                        print("[AWAKE] 'Suno Saarthi' heard. How can I help?")
                        self.standby = False
                        self.last_active_time = time.time()
                else:
                    # Once awake, listen for user commands
                    print("[ACTIVE] Awaiting your command...")

                    # Get command either from voice or input
                    command_result = self.detector.listen_for_command(timeout=5)

                    # For demo purposes
                    print("For demo purpose (type your command):")
                    manual_input = input()

                    if manual_input.lower() in ["quit", "exit", "stop"]:
                        print("[INFO] Exiting Suno Saarthi. Drive safe!")
                        break

                    # Process either voice command or manual input
                    recognized_text = (
                        command_result.get("command", "") if command_result.get("status") == "success" else ""
                    )
                    recognized_text = recognized_text or manual_input

                    # Skip if no command detected
                    if not recognized_text:
                        if (time.time() - self.last_active_time) > self.active_mode_timeout:
                            print("[INFO] Timeout. Going back to standby.")
                            self.standby = True
                        continue

                    self.last_active_time = time.time()  # Reset timer

                    await self.process_command(recognized_text)

            except KeyboardInterrupt:
                print("\n[INFO] KeyboardInterrupt received. Exiting.")
                break

    async def process_command(self, command: str) -> Dict[str, Any]:
        """
        Process a user command and generate an appropriate response

        Args:
            command: The user's command text

        Returns:
            Dict with response information
        """
        # Check if it's a route-related query
        if any(
            keyword in command.lower()
            for keyword in [
                "flyover",
                "shortcut",
                "traffic",
                "route",
                "turn",
                "destination",
            ]
        ):
            # Handle as a navigation query
            nav_result = self.navigation.process_navigation_query(query=command, current_location=self.current_location)
            response_text = nav_result.get("response", "")
            print(f"Saarthi (Route Info): {response_text}")
            return nav_result

        # Otherwise, use LLM for conversation
        conversation_prompt = self.conversation_context + f"\nUser: {command}\nSaarthi:"
        llm_result = self.llm.generate_reply(prompt=command, max_new_tokens=CONFIG.LLM.MAX_TOKENS)

        response_text = llm_result.get("response", "I didn't understand that. Could you please repeat?")
        print(f"Saarthi: {response_text}")

        # Optionally append to conversation context
        self.conversation_context += f"User: {command}\nSaarthi: {response_text}\n"

        return llm_result

    async def set_navigation(self, origin: str, destination: str):
        """
        Set up navigation between two points

        Args:
            origin: Starting location
            destination: Destination location

        Returns:
            Dict with navigation setup status
        """
        try:
            # Get directions from Google Maps
            directions = self.navigation.get_directions(origin=origin, destination=destination)

            if directions.get("status") == "error":
                return {
                    "status": "error",
                    "message": directions.get("message", "Could not set up navigation"),
                }

            # Store current route and locations
            self.current_route = directions.get("routes", [])
            self.current_location = origin
            self.destination = destination

            return {
                "status": "success",
                "message": f"Navigation set from {origin} to {destination}",
                "route_overview": self._get_route_overview(),
            }

        except Exception as e:
            return {"status": "error", "message": f"Error setting navigation: {str(e)}"}

    def _get_route_overview(self) -> Dict[str, Any]:
        """Get a summary of the current route"""
        if not self.current_route or not len(self.current_route) > 0:
            return {"status": "no_route"}

        try:
            route = self.current_route[0]
            legs = route.get("legs", [])

            if not legs:
                return {"status": "no_legs"}

            overview = {
                "origin": legs[0].get("start_address", "Unknown"),
                "destination": legs[0].get("end_address", "Unknown"),
                "distance": legs[0].get("distance", {}).get("text", "Unknown"),
                "duration": legs[0].get("duration", {}).get("text", "Unknown"),
                "steps_count": len(legs[0].get("steps", [])),
            }

            # Add first few steps
            steps = legs[0].get("steps", [])
            overview["next_steps"] = []

            for i, step in enumerate(steps[:3]):  # First 3 steps
                overview["next_steps"].append(
                    {
                        "instruction": step.get("html_instructions", ""),
                        "distance": step.get("distance", {}).get("text", ""),
                        "duration": step.get("duration", {}).get("text", ""),
                    }
                )

            return overview
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error getting route overview: {str(e)}",
            }


async def main():
    """Entry point for Suno Saarthi core functionality"""
    core = SunoSaarthiCore()
    await core.run_conversation_loop()


if __name__ == "__main__":
    asyncio.run(main())
