from google import genai
from google.genai import types
import json

class AIEngine:
    def __init__(self, api_key, memory_system):
        self.memory_system = memory_system
        self.client = genai.Client(api_key=api_key)
        self.primary_model = 'gemini-3.5-flash'
        self.fallback_models = [
            'gemini-3.1-flash-lite',
            'gemini-2.5-flash',
            'gemini-2.5-flash-lite',
        ]
        self.current_model = self.primary_model
        
        self.base_instruction = """You are Clove, a smart and friendly AI desktop assistant. You speak naturally, like a real person — casual, calm, and helpful. Think of yourself as a modern assistant similar to ChatGPT or Copilot.

Rules for your responses:
- Be conversational and natural. Use simple, clear English.
- Keep responses concise. Don't over-explain unless the user asks for detail.
- Never use robotic, sci-fi, or dramatic language. No phrases like "systems operational", "awaiting command", "executing protocol", "affirmative", etc.
- Never narrate your own actions like "Scanning...", "Processing...", "Initiating..."
- Be warm and friendly but not over-the-top. No excessive emojis or excitement.
- Use markdown formatting only when it genuinely helps (like code blocks or lists), not for every response.
- For simple questions, give simple answers. "Hey!" not "Greetings, user."
- For tasks like opening apps, just confirm briefly: "Opening Chrome." not "I am now initiating the Chrome browser application."
- You can help with system tasks (opening apps, volume control, screenshots), answer questions, write code, and have normal conversations.

Examples of good responses:
- User: "Hi" → "Hey! What's up?"
- User: "Open Spotify" → "Opening Spotify."
- User: "What's the weather like?" → "I can't check live weather yet, but I can help you search for it. Want me to open a weather site?"
- User: "Thanks" → "You're welcome!"
"""
        self.coding_instruction = """You are Clove, a smart AI assistant currently in coding mode. You're an expert programmer who explains things clearly and writes clean, efficient code.

Rules:
- Write clean, well-commented code.
- Explain your approach briefly before diving into code when helpful.
- Use proper markdown with code blocks and syntax highlighting.
- Be direct and practical — skip unnecessary theory unless asked.
- Speak naturally, not like a textbook.
"""
        
        self.system_instruction = self.base_instruction
        self.mode = "standard"
        self.chat_history = []
        self._load_history()

    def _load_history(self):
        """Load only last 10 messages for fast context from the active session."""
        self.chat_history = []
        curr_session = self.memory_system.get_current_session()
        raw_history = curr_session.get('history', [])[-10:]
        for entry in raw_history:
            role = 'user' if entry['role'] == 'user' else 'model'
            self.chat_history.append(
                types.Content(role=role, parts=[types.Part.from_text(text=entry['content'])])
            )

    def set_mode(self, mode):
        if mode == "coding":
            self.system_instruction = self.coding_instruction
            self.mode = "coding"
            return "Switched to coding mode. I'm ready to help you write some code!"
        else:
            self.system_instruction = self.base_instruction
            self.mode = "standard"
            return "Back to normal mode. How can I help?"

    def get_response(self, prompt):
        import time
        max_retries = 3
        retry_delay = 1 # second
        
        models_to_try = [self.current_model] + [m for m in self.fallback_models if m != self.current_model]
        
        # Add user message to history once
        self.chat_history.append(
            types.Content(role='user', parts=[types.Part.from_text(text=prompt)])
        )

        for model_name in models_to_try:
            for attempt in range(max_retries):
                try:
                    print(f"DEBUG: AI [Model: {model_name}] [Attempt: {attempt+1}] getting response...")
                    
                    response = self.client.models.generate_content(
                        model=model_name,
                        contents=self.chat_history[-15:],
                        config=types.GenerateContentConfig(
                            system_instruction=self.system_instruction,
                            temperature=0.7,
                            max_output_tokens=2048,
                        )
                    )

                    reply = response.text
                    print(f"DEBUG: AI received response from {model_name}")

                    # Update current model for future calls if this one worked
                    self.current_model = model_name

                    # Add model response to history
                    self.chat_history.append(
                        types.Content(role='model', parts=[types.Part.from_text(text=reply)])
                    )

                    # Save to persistent memory
                    self.memory_system.add_to_history('user', prompt)
                    self.memory_system.add_to_history('assistant', reply)

                    return reply

                except Exception as e:
                    error_str = str(e)
                    print(f"DEBUG: Error with {model_name}: {error_str}")
                    
                    # If it's a 503 or 429, retry with backoff
                    if "503" in error_str or "429" in error_str or "high demand" in error_str.lower():
                        if attempt < max_retries - 1:
                            wait_time = retry_delay * (2 ** attempt)
                            print(f"DEBUG: Retrying in {wait_time}s...")
                            time.sleep(wait_time)
                            continue
                    
                    # If retries failed or it's another error, try next model
                    print(f"DEBUG: Switching model from {model_name}...")
                    break
        
        # If all else fails
        if self.chat_history and self.chat_history[-1].role == 'user':
            self.chat_history.pop()
        return "Sorry, I'm having a bit of trouble right now. Could you try again in a moment?"

    def get_streaming_response(self, prompt, attachments=None):
        """Generator that yields response chunks with fallback and retry logic."""
        import time
        max_retries = 1
        retry_delay = 0.5
        
        models_to_try = [self.current_model] + [m for m in self.fallback_models if m != self.current_model]
        
        # Build contents/parts
        parts = [types.Part.from_text(text=prompt or "Analyze the attached file.")]
        if attachments:
            for att in attachments:
                if att.get('type') == 'image':
                    import base64
                    try:
                        img_bytes = base64.b64decode(att['content'])
                        mime_type = att.get('mime_type', 'image/png')
                        parts.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))
                    except Exception as e:
                        print(f"Error decoding image attachment: {e}")
                elif att.get('type') == 'text':
                    text_content = f"\n\n--- START OF FILE {att['name']} ---\n{att['content']}\n--- END OF FILE {att['name']} ---\n"
                    parts.append(types.Part.from_text(text=text_content))
                else:
                    parts.append(types.Part.from_text(text=f"\n[Attached file: {att['name']} ({att.get('size', 0)} bytes)]"))

        # Add user message to history once
        self.chat_history.append(
            types.Content(role='user', parts=parts)
        )

        full_reply = ""
        
        for model_name in models_to_try:
            try:
                print(f"DEBUG: AI Streaming [Model: {model_name}]...")
                
                stream = self.client.models.generate_content_stream(
                    model=model_name,
                    contents=self.chat_history[-6:],
                    config=types.GenerateContentConfig(
                        system_instruction=self.system_instruction,
                        temperature=0.7,
                        max_output_tokens=512,
                    )
                )

                for chunk in stream:
                    if chunk.text:
                        full_reply += chunk.text
                        yield chunk.text

                # If successful, keep this as the current model
                self.current_model = model_name
                self.chat_history.append(
                    types.Content(role='model', parts=[types.Part.from_text(text=full_reply)])
                )
                
                # Format a text-only representation of the prompt to save to memory
                memory_prompt = prompt
                if attachments:
                    memory_prompt += "\n\n[Attached files: " + ", ".join([a['name'] for a in attachments]) + "]"
                
                self.memory_system.add_to_history('user', memory_prompt)
                self.memory_system.add_to_history('assistant', full_reply)
                return

            except Exception as e:
                print(f"DEBUG: Error with {model_name}: {str(e)[:50]}...")
                continue # Try next model immediately
        
        # All models failed
        if self.chat_history and self.chat_history[-1].role == 'user':
            self.chat_history.pop()
        yield "Sorry, I'm having trouble connecting right now. Give me a sec and try again."

    def analyze_screen(self, image_path):
        # Use a list of models to try for vision as well
        models_to_try = [self.current_model] + [m for m in self.fallback_models if m != self.current_model]
        
        try:
            # Read image file
            with open(image_path, 'rb') as f:
                image_data = f.read()
        except Exception as e:
            return f"Error reading screenshot: {str(e)}"

        prompt = "I have captured the screen. Please look at this image and explain what you see. If there are any errors or specific tasks on screen, please analyze them and provide a helpful response."
        
        for model_name in models_to_try:
            try:
                print(f"DEBUG: AI [Model: {model_name}] analyzing screen...")
                
                response = self.client.models.generate_content(
                    model=model_name,
                    contents=[
                        types.Content(role='user', parts=[
                            types.Part.from_bytes(data=image_data, mime_type='image/png'),
                            types.Part.from_text(text=prompt)
                        ])
                    ],
                    config=types.GenerateContentConfig(
                        system_instruction=self.system_instruction,
                        temperature=0.7,
                    )
                )

                reply = response.text
                
                # Update current model if successful
                self.current_model = model_name

                # Save to history (without the image data for memory efficiency)
                self.memory_system.add_to_history('user', "[Screen Captured for Analysis]")
                self.memory_system.add_to_history('assistant', reply)
                
                return reply
            except Exception as e:
                print(f"DEBUG: Error analyzing screen with {model_name}: {str(e)}")
                continue
                
        return "I had trouble analyzing your screen. Could you try again?"
