import re
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from core.llm import LLMGemini

# Initialize the base LLM
llm = LLMGemini()


# Function to clean the LLM response
def clean_llm_response(response_text: str) -> str:
    """
    Extract the actual response from LLM output, removing debugging info.

    Args:
        response_text: Raw LLM response text

    Returns:
        Cleaned response with only the actual answer
    """
    # If response contains a Saarthi: prefix anywhere, extract only that part
    saarthi_pattern = r'Saarthi:\s*"?(.*?)"?$'
    saarthi_match = re.search(saarthi_pattern, response_text, re.MULTILINE | re.DOTALL)
    if saarthi_match:
        return saarthi_match.group(1).strip()

    # If response contains explanatory text followed by translation in parentheses
    # Example: "Okay, assuming... Saarthi: "Seedhe chalo..." (Go straight...)"
    translation_pattern = r"\(([^)]+)\)$"
    translation_match = re.search(translation_pattern, response_text, re.MULTILINE | re.DOTALL)
    if translation_match:
        return translation_match.group(1).strip()

    # If there's a clear Hindi/English mix response at the end
    # Look for quotes that might contain the actual response
    quotes_pattern = r'"([^"]+)"'
    quotes_matches = re.findall(quotes_pattern, response_text)
    if quotes_matches and any(re.search(r"[ऀ-ॿ]", quote) for quote in quotes_matches):
        # Return the last quoted text that contains Hindi characters
        for quote in reversed(quotes_matches):
            if re.search(r"[ऀ-ॿ]", quote):
                return quote.strip()

    # If we detect "here's a possible response:" pattern
    possible_response_pattern = r"here'?s\s+a\s+possible\s+response:?\s*(.*)"
    possible_match = re.search(possible_response_pattern, response_text.lower(), re.IGNORECASE | re.DOTALL)
    if possible_match:
        return possible_match.group(1).strip()

    # Fall back to returning everything after the last colon if nothing else matched
    last_colon_pattern = r":\s*(.+)$"
    last_colon_match = re.search(last_colon_pattern, response_text, re.DOTALL)
    if last_colon_match:
        return last_colon_match.group(1).strip()

    # If none of the patterns matched, return the original text
    return response_text.strip()


# Default navigation context
DEFAULT_CONTEXT = """
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

IMPORTANT: Always provide your direct response only, without ANY explanation, analysis, or thinking. No meta-commentary. Don't talk about what you're assuming or figuring out. Just respond as Saarthi would to the user.

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

Example Interactions:
User: "Flyover lena hai ya nahi?"
Saarthi: "Haan, 800m aage flyover lena better hai. Right lane shift karein"

User: "Shortcut pata hai?"
Saarthi: "Haan, ek gali se shortcut hai lekin thoda congested ho sakta hai. Bataun?"

User: "Bohot traffic hai!"
Saarthi: "Samajh raha hoon. Next signal se left le lijiye, wahan kam jam hai"

User: "Yaha se kaha jau?"
Saarthi: "Seedhe chalo. Aage bada chowk aayega."

Keep responses brief and focused on navigation when the user is driving. NEVER include any analysis or thinking in your response - just reply directly as Saarthi would.
"""


class Message:
    def __init__(self, role: str, content: str):
        self.role = role
        self.content = content
        self.timestamp = datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        return {"role": self.role, "content": self.content, "timestamp": self.timestamp.isoformat()}


class Session:
    def __init__(self, session_id: str, system_prompt: str = DEFAULT_CONTEXT):
        self.session_id = session_id
        self.system_prompt = system_prompt
        self.messages: List[Message] = []
        self.created_at = datetime.now()
        self.last_accessed = datetime.now()

    def add_message(self, role: str, content: str) -> None:
        """Add a message to the conversation history"""
        self.messages.append(Message(role, content))
        self.last_accessed = datetime.now()

    def get_formatted_history(self) -> str:
        """Format the conversation history for the LLM"""
        # Start with the system prompt
        formatted = self.system_prompt + "\n\n"

        # Add all previous messages in the conversation
        for message in self.messages:
            if message.role == "user":
                formatted += f"User: {message.content}\n"
            else:
                formatted += f"Saarthi: {message.content}\n"

        # Add a proper prompt suffix for the assistant to continue
        if self.messages and self.messages[-1].role == "user":
            formatted += "Saarthi: "

        return formatted

    def clear_history(self) -> None:
        """Clear the conversation history"""
        self.messages = []

    def is_expired(self, expiry_minutes: int = 30) -> bool:
        """Check if the session has expired"""
        expiry_time = datetime.now() - timedelta(minutes=expiry_minutes)
        return self.last_accessed < expiry_time


class SessionManager:
    def __init__(self, session_expiry_minutes: int = 30):
        self.sessions: Dict[str, Session] = {}
        self.session_expiry_minutes = session_expiry_minutes

    def create_session(self, session_id: Optional[str] = None, system_prompt: Optional[str] = None) -> str:
        """Create a new session with optional custom ID and system prompt"""
        # Generate session ID if not provided
        if not session_id:
            session_id = str(uuid.uuid4())

        # Use default system prompt if not provided
        if not system_prompt:
            system_prompt = DEFAULT_CONTEXT

        # Create new session
        self.sessions[session_id] = Session(session_id, system_prompt)

        return session_id

    def get_session(self, session_id: str) -> Optional[Session]:
        """Get an existing session by ID"""
        # Clean expired sessions first
        self._clean_expired_sessions()

        # Return session if it exists
        session = self.sessions.get(session_id)
        if session:
            session.last_accessed = datetime.now()
        return session

    def add_message(self, session_id: str, role: str, content: str) -> bool:
        """Add a message to a session"""
        session = self.get_session(session_id)
        if not session:
            return False

        session.add_message(role, content)
        return True

    def get_response(self, session_id: str, user_message: str) -> Dict[str, Any]:
        """Get a response for a user message"""
        # Try to get existing session or create a new one
        session = self.get_session(session_id)
        if not session:
            session_id = self.create_session(session_id)
            session = self.get_session(session_id)

        # Add user message to history
        session.add_message("user", user_message)

        # Get formatted conversation history
        conversation = session.get_formatted_history()

        # Generate response from LLM
        llm_response = llm.chat(conversation)

        # If successful, clean the response and add to history
        if llm_response.get("status") == "success":
            # Clean the response text to extract only the actual response
            raw_response = llm_response.get("response", "")
            cleaned_response = clean_llm_response(raw_response)

            # Store the cleaned response in the response object and history
            llm_response["response"] = cleaned_response
            session.add_message("assistant", cleaned_response)

        # Add session_id to response
        llm_response["session_id"] = session_id

        return llm_response

    def delete_session(self, session_id: str) -> bool:
        """Delete a session"""
        if session_id in self.sessions:
            del self.sessions[session_id]
            return True
        return False

    def _clean_expired_sessions(self) -> None:
        """Clean up expired sessions"""
        expired = [sid for sid, session in self.sessions.items() if session.is_expired(self.session_expiry_minutes)]

        for session_id in expired:
            self.delete_session(session_id)


# Create singleton instance
session_manager = SessionManager()


def generate_reply(prompt: str, include_context: bool = True, session_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Generate response with dynamic token handling and navigation context

    Args:
        prompt: The user input prompt
        include_context: Whether to include the default assistant context
        session_id: Optional session ID to include chat history

    Returns:
        Dict containing response status and text
    """
    if session_id:
        session = session_manager.get_session(session_id)
        if session:
            full_prompt = session.get_formatted_history() + "\nUser: " + prompt + "\nSaarthi:"
        else:
            full_prompt = DEFAULT_CONTEXT + "\n\nUser: " + prompt + "\nSaarthi:" if include_context else prompt
    else:
        full_prompt = DEFAULT_CONTEXT + "\n\nUser: " + prompt + "\nSaarthi:" if include_context else prompt

    return llm.chat(full_prompt)


def process_navigation_prompt(
    user_query: str, navigation_context: Optional[Dict] = None, session_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Process a navigation-related prompt with specific context

    Args:
        user_query: The user's navigation question
        navigation_context: Optional dict with current route, location, etc.
        session_id: Optional session ID to include chat history

    Returns:
        Dict with response formatted for navigation
    """
    # Create a contextualized navigation prompt
    context = "You are navigating and need to provide clear, concise directions. "

    if navigation_context:
        context += f"Current location: {navigation_context.get('current_location', 'Unknown')}. "
        context += f"Destination: {navigation_context.get('destination', 'Unknown')}. "
        context += f"Next turn: {navigation_context.get('next_turn', 'Unknown')}. "
        context += f"Distance remaining: {navigation_context.get('distance_remaining', 'Unknown')}. "

    # Include route info
    route_info = navigation_context.get("route_info", [])
    if route_info:
        context += (
            "Route details: "
            + ", ".join(
                [f"{step['instruction']} ({step['distance']['text']})" for leg in route_info for step in leg["steps"]]
            )
            + ". "
        )

    context += "\nKeep your response under 15 words, focused on the immediate navigation need."

    full_prompt = context + f"\n\nUser asks: {user_query}\nNavigation response:"

    return generate_reply(full_prompt, include_context=False, session_id=session_id)
