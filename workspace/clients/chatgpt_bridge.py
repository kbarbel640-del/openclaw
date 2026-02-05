
# clients/chatgpt_bridge.py

import os
import requests
from typing import Dict, Any, List
from quantum_memory.cloud_api import CrossPlatformMemoryAPI

class ChatGPTBridge:
    def __init__(self):
        self.memory_api = CrossPlatformMemoryAPI()
        self.persona_id = os.getenv("CHATGPT_PERSONA_ID", "default_chatgpt_persona")
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.openai_endpoint = "https://api.openai.com/v1/chat/completions" # Example endpoint

        if not self.openai_api_key:
            print("Warning: OPENAI_API_KEY not set. ChatGPT interaction will be limited.")

        print(f"ChatGPTBridge initialized for persona: {self.persona_id}")

    def save_chat_history(self, chat_history: List[Dict[str, str]]):
        """
        Saves the current chat history of the ChatGPT persona to the cross-platform memory.
        """
        print(f"ChatGPTBridge: Saving chat history for {self.persona_id}")
        memory_to_save = {
            "state_key_value": {"chat_history": chat_history},
            # "embedding": self._generate_embedding_from_chat(chat_history)
        }
        self.memory_api.save_persona_memory(self.persona_id, memory_to_save)
        print(f"ChatGPTBridge: Chat history saved for {self.persona_id}")

    def load_chat_history(self) -> List[Dict[str, str]]:
        """
        Loads the last saved chat history of the ChatGPT persona from the cross-platform memory.
        """
        print(f"ChatGPTBridge: Loading chat history for {self.persona_id}")
        loaded_memory = self.memory_api.load_persona_memory(self.persona_id)
        # Assuming 'redis_state' contains the key-value pairs representing the state
        chat_history = loaded_memory.get("redis_state", {}).get("chat_history", [])
        print(f"ChatGPTBridge: Chat history loaded for {self.persona_id}")
        return chat_history

    def send_to_chatgpt(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Sends messages to the ChatGPT API and returns the response.
        """
        if not self.openai_api_key:
            print("Error: OPENAI_API_KEY is not set. Cannot send messages to ChatGPT.")
            return {"error": "OPENAI_API_KEY missing"}

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.openai_api_key}"
        }
        payload = {
            "model": "gpt-3.5-turbo", # Or another appropriate model
            "messages": messages
        }
        print(f"ChatGPTBridge: Sending messages to OpenAI API for {self.persona_id}")
        try:
            response = requests.post(self.openai_endpoint, headers=headers, json=payload)
            response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error communicating with OpenAI API: {e}")
            return {"error": str(e)}

    def _generate_embedding_from_chat(self, chat_history: List[Dict[str, str]]) -> List[float]:
        """
        Placeholder for generating an embedding from chat history.
        """
        print("ChatGPTBridge: Generating dummy embedding from chat history.")
        return [0.0] * 1536 # Dummy embedding

# Example Usage (for testing/demonstration)
if __name__ == "__main__":
    # To run this example, you might need to set CHATGPT_PERSONA_ID and OPENAI_API_KEY
    # export CHATGPT_PERSONA_ID="test_persona_chatgpt"
    # export OPENAI_API_KEY="your_openai_api_key_here"
    chatgpt_bridge = ChatGPTBridge()

    print("
--- Saving Chat History ---")
    current_chat = [
        {"role": "user", "content": "Hello, how are you?"},
        {"role": "assistant", "content": "I'm doing well, thank you!"}
    ]
    chatgpt_bridge.save_chat_history(current_chat)

    print("
--- Loading Chat History ---")
    loaded_chat = chatgpt_bridge.load_chat_history()
    print(f"Loaded chat history: {loaded_chat}")

    print("
--- Sending Message to ChatGPT (requires OPENAI_API_KEY) ---")
    if os.getenv("OPENAI_API_KEY"):
        messages_to_send = loaded_chat + [{"role": "user", "content": "What is the capital of France?"}]
        response = chatgpt_bridge.send_to_chatgpt(messages_to_send)
        print(f"ChatGPT Response: {response}")
    else:
        print("Skipping ChatGPT interaction as OPENAI_API_KEY is not set.")
