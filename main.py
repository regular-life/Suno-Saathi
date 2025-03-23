import time
from modules.wake_word import WakeWordDetector
from modules.llm_interface import TinyLlamaLLM
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
    llm = TinyLlamaLLM()

    conversation_context = (
        "You are Suno Saarthi, a helpful AI co-passenger in the Indian context.\n"
        "You can mix English and Hindi. Provide route guidance and answer driver queries.\n\n"
    )

    standby = True
    last_active_time = 0
    active_mode_timeout = 30  # seconds of inactivity before returning to standby
    listening_for_command = False

    while True:
        try:
            if standby:
                # Step 1: Listen for the wake word
                recognized_text = detector.listen_for_wake_word()
                if detector.detect_wake_word(recognized_text):
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
                reply = llm.generate_reply(conversation_prompt, max_new_tokens=60)
                print(f"Saarthi: {reply}")

                # Optionally append to conversation_context
                conversation_context += f"User: {recognized_text}\nSaarthi: {reply}\n"

        except KeyboardInterrupt:
            print("\n[INFO] KeyboardInterrupt received. Exiting.")
            break


if __name__ == "__main__":
    main()
