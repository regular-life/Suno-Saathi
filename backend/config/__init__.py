from .settings import *

# Initialize settings check
api_key_status = check_api_keys()

# Print a warning if any API keys are missing
if not all(api_key_status.values()):
    missing_keys = [key for key, status in api_key_status.items() if not status]
    print(f"WARNING: Missing API keys: {', '.join(missing_keys)}")
    print("Some functionality may not work correctly.") 