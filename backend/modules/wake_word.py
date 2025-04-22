from typing import Any, Dict, List, Optional, Tuple

import speech_recognition as sr

# Define wake words list - could be moved to a config file later
WAKE_WORDS = ["suno sathi", "he saarthi", "hello sarathi"]


class WakeWordDetector:
    def __init__(
        self,
        energy_threshold=800,
        pause_threshold=0.8,
        wake_words: Optional[List[str]] = None,
    ):
        """
        Initialize the wake word detector with configurable parameters.

        Args:
            energy_threshold: Adjust for ambient noise (higher = more noise tolerance).
            pause_threshold: How long of a pause before finishing a phrase.
            wake_words: Optional list of wake word phrases to override defaults
        """
        self.recognizer = sr.Recognizer()
        self.recognizer.energy_threshold = energy_threshold
        self.recognizer.pause_threshold = pause_threshold
        self.microphone = sr.Microphone()
        self.active = False  # If True, we've heard the wake word
        self.wake_words = wake_words if wake_words is not None else WAKE_WORDS

    def listen_for_wake_word(self) -> str:
        """
        Listen from microphone and transcribe speech to text.

        Returns:
            Recognized text or empty string if none recognized
        """
        with self.microphone as source:
            # Optional: Adjust for ambient noise, at the cost of some overhead
            self.recognizer.adjust_for_ambient_noise(source, duration=1)

            print("[STANDBY] Listening for wake word...")
            audio = self.recognizer.listen(source, phrase_time_limit=5)

        try:
            text = self.recognizer.recognize_google(audio, language="en-IN")
            text = text.lower().strip()
            print(f"[DEBUG] Heard: {text}")
            return text
        except sr.UnknownValueError:
            # Could not understand audio
            return ""
        except sr.RequestError as e:
            print(f"[ERROR] SpeechRecognition Error: {e}")
            return ""

    def detect_wake_word(self, text: str) -> bool:
        """
        Check if recognized text contains any known wake word.

        Args:
            text: The text to check for wake words

        Returns:
            True if a wake word is detected, False otherwise
        """
        for phrase in self.wake_words:
            if phrase in text:
                self.active = True
                return True
        return False

    def listen_for_command(self, timeout: int = 5) -> Dict[str, Any]:
        """
        Listen for a command after wake word has been detected.

        Args:
            timeout: Maximum seconds to listen for command

        Returns:
            Dictionary with recognition status and result
        """
        with self.microphone as source:
            print(f"[ACTIVE] Listening for command (timeout: {timeout}s)...")
            try:
                audio = self.recognizer.listen(source, timeout=timeout)

                try:
                    text = self.recognizer.recognize_google(audio, language="en-IN")
                    text = text.lower().strip()
                    print(f"[DEBUG] Command heard: {text}")
                    return {"status": "success", "command": text}
                except sr.UnknownValueError:
                    # Could not understand audio
                    return {
                        "status": "error",
                        "error_type": "unknown_value",
                        "message": "Could not understand audio",
                    }
                except sr.RequestError as e:
                    print(f"[ERROR] SpeechRecognition Error: {e}")
                    return {
                        "status": "error",
                        "error_type": "request_error",
                        "message": str(e),
                    }
            except sr.WaitTimeoutError:
                return {
                    "status": "error",
                    "error_type": "timeout",
                    "message": "Listening timed out",
                }

    def reset(self):
        """Reset the wake word detector state"""
        self.active = False
