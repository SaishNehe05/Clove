import sys
import os

# Add root folder to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.memory_system import MemorySystem
from core.ai_engine import AIEngine

print("Initializing MemorySystem...")
memory = MemorySystem()

print("Initializing AIEngine...")
ai = AIEngine(memory.get_config("gemini_api_key"), memory)

print(f"Primary model configured: {ai.primary_model}")
print(f"Fallback models configured: {ai.fallback_models}")

print("\nSending a test prompt to streaming response generator...")
full_response = ""
try:
    for chunk in ai.get_streaming_response("Hello Clove! How are you doing today?"):
        sys.stdout.write(chunk)
        sys.stdout.flush()
        full_response += chunk
    print("\n\nSUCCESS! Chat completed perfectly.")
except Exception as e:
    print(f"\nERROR: {e}")
