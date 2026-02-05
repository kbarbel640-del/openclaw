
# clients/warp_client.py

import os
from typing import Dict, Any, List
from quantum_memory.cloud_api import CrossPlatformMemoryAPI

class WarpClient:
    def __init__(self):
        self.memory_api = CrossPlatformMemoryAPI()
        self.persona_id = os.getenv("WARP_PERSONA_ID", "default_warp_persona")
        print(f"WarpClient initialized for persona: {self.persona_id}")

    def save_current_state(self, state_data: Dict[str, Any]):
        """
        Saves the current state of the Warp persona to the cross-platform memory.
        """
        print(f"WarpClient: Saving state for {self.persona_id}")
        memory_to_save = {
            "state_key_value": state_data,
            # Example of how an embedding might be generated and saved
            # "embedding": self._generate_embedding_from_state(state_data)
        }
        self.memory_api.save_persona_memory(self.persona_id, memory_to_save)
        print(f"WarpClient: State saved for {self.persona_id}")

    def load_last_state(self) -> Dict[str, Any]:
        """
        Loads the last saved state of the Warp persona from the cross-platform memory.
        """
        print(f"WarpClient: Loading state for {self.persona_id}")
        loaded_memory = self.memory_api.load_persona_memory(self.persona_id)
        # Assuming 'redis_state' contains the key-value pairs representing the state
        state_data = loaded_memory.get("redis_state", {})
        print(f"WarpClient: State loaded for {self.persona_id}: {state_data}")
        return state_data

    def _generate_embedding_from_state(self, state_data: Dict[str, Any]) -> List[float]:
        """
        Placeholder for generating an embedding from the persona's state data.
        In a real scenario, this would involve a language model.
        """
        # This is a dummy embedding for demonstration purposes
        print("WarpClient: Generating dummy embedding from state.")
        return [0.0] * 1536 # Example: 1536-dimension embedding

# Example Usage (for testing/demonstration)
if __name__ == "__main__":
    # To run this example, you might need to set WARP_PERSONA_ID environment variable
    # export WARP_PERSONA_ID="test_persona_warp"
    warp_client = WarpClient()

    print("
--- Saving State ---")
    current_state = {"last_command": "ls -la", "context_summary": "working on cloud_api.py"}
    warp_client.save_current_state(current_state)

    print("
--- Loading State ---")
    loaded_state = warp_client.load_last_state()
    print(f"Loaded state: {loaded_state}")
