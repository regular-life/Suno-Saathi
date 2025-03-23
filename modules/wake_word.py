import speech_recognition as sr

WAKE_WORDS = ["suno saarthi", "suno sarathi", "hello saarthi"]


class WakeWordDetector:
    """
    Continuously listens from the microphone.
    If 'Suno Saarthi' is detected in the recognized speech,
    it triggers the system to switch from standby to active mode.
    """

    def __init__(self, energy_threshold=300, pause_threshold=0.8):
        """
        :param energy_threshold: Adjust for ambient noise (higher = more noise tolerance).
        :param pause_threshold: How long of a pause before finishing a phrase.
        """
        self.recognizer = sr.Recognizer()
        self.recognizer.energy_threshold = energy_threshold
        self.recognizer.pause_threshold = pause_threshold
        self.microphone = sr.Microphone()
        self.active = False  # If True, we've heard the wake word

    def listen_for_wake_word(self) -> str:
        """
        1. Listens from microphone
        2. Transcribes speech to text
        3. Returns recognized text or empty string if none
        """
        with self.microphone as source:
            # Optional: Adjust for ambient noise, at the cost of some overhead
            # self.recognizer.adjust_for_ambient_noise(source, duration=1)

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
        """Checks if recognized text contains any known wake word."""
        for phrase in WAKE_WORDS:
            if phrase in text:
                return True
        return False
