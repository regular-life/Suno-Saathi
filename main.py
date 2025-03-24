import time
from modules.wake_word import WakeWordDetector
from modules.llm_interface import *
from modules.navigation import get_route_info

def main():
    """
    A baseline conversational loop:
    1. Continuously listen for 'Suno Saarthi'.
    2. When detected, accept next user commands for a few seconds.
    3. Use LLaMA to respond conversationally OR fetch route info.
    4. Return to standby after a short idle period.
    """

    # Initialize
    detector = WakeWordDetector()
    # llm = TinyLlamaLLM()
    # llm = DeepSeekLLM()
    llm = GeminiLLM()

    conversation_context = """
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
    Saarthi: "Samajh raha hoon. Next signal se left le lijiye, wahan kam jam hai"
    """

    standby = True
    last_active_time = 0
    active_mode_timeout = 30  # seconds of inactivity before returning to standby
    listening_for_command = False

    while True:
        try:
            if standby:
                # Step 1: Listen for the wake word
                recognized_text = detector.listen_for_wake_word()
                inp = input("For demo purpose (respond with \"Hello\"):")
                if detector.detect_wake_word(recognized_text) or inp.lower() == "hello":
                    print("[AWAKE] 'Suno Saarthi' heard. How can I help?")
                    standby = False
                    listening_for_command = True
                    last_active_time = time.time()
            else:
                # Step 2: Once awake, listen for user commands
                print("[ACTIVE] Awaiting your command for ~5 seconds...")
                recognized_text = detector.listen_for_wake_word()  # Reusing the same method

                # If user says nothing, check idle time
                if not recognized_text:
                    if (time.time() - last_active_time) > active_mode_timeout:
                        print("[INFO] Timeout. Going back to standby.")
                        standby = True
                        listening_for_command = False
                    else:
                        print("[INFO] No speech detected, still active.")
                    continue

                last_active_time = time.time()  # Reset idle timer

                if recognized_text in ["quit", "exit", "stop"]:
                    print("[INFO] Exiting Suno Saarthi. Drive safe!")
                    break

                # 2a. Check if user is repeating the wake word
                if detector.detect_wake_word(recognized_text):
                    print("[AWAKE] Already active. Go ahead.")
                    continue

                # 2b. Check if it's a route-related query:
                if any(keyword in recognized_text.lower() for keyword in ["flyover", "shortcut", "traffic", "route"]):
                    route_ans = get_route_info(recognized_text)
                    print(f"Saarthi (Route Info): {route_ans}")
                    continue

                # 2c. Otherwise, pass to LLM for conversation
                conversation_prompt = conversation_context + f"User: {recognized_text}\nSaarthi:"
                reply = llm.generate_reply(conversation_prompt, max_new_tokens=100)
                print(f"Saarthi: {reply}")

                # Optionally append to conversation_context
                conversation_context += f"User: {recognized_text}\nSaarthi: {reply}\n"

        except KeyboardInterrupt:
            print("\n[INFO] KeyboardInterrupt received. Exiting.")
            break


if __name__ == "__main__":
    main()
