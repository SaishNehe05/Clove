import os
import time
import json
import threading
import sys
import io

# Force UTF-8 encoding for Windows terminal
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
from core.ai_engine import AIEngine
from core.automation import AutomationEngine
from core.memory_system import MemorySystem
from core.file_manager import FileManager
from core.system_monitor import SystemMonitor
from core.voice_engine import VoiceEngine
import speech_recognition as sr

app = Flask(__name__, template_folder='.')
app.config['SECRET_KEY'] = 'clove-secret-key'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Initialize Modules
memory = MemorySystem()
ai = AIEngine(memory.get_config("gemini_api_key"), memory)
automation = AutomationEngine()
files = FileManager()
monitor = SystemMonitor()
voice = VoiceEngine(
    api_key=memory.get_config("elevenlabs_api_key"),
    voice_id=memory.get_config("voice_id", "EXAVITQu4vr4xnNLMQyz")
)

@app.route('/')
def index():
    return render_template('index.html')

# ─── AUTHENTICATION HANDLERS ───
@socketio.on('auth_login')
def on_login(data):
    result = memory.sign_in(data['email'], data['password'])
    if "error" in result:
        emit('auth_error', {"message": result["error"]})
    else:
        emit('auth_success', result)

@socketio.on('auth_signup')
def on_signup(data):
    result = memory.sign_up(data['name'], data['email'], data['password'])
    if "error" in result:
        emit('auth_error', {"message": result["error"]})
    else:
        emit('auth_success', result)

@socketio.on('auth_session')
def on_session(data):
    memory.set_user(data['user_id'])

@socketio.on('get_config')
def on_get_config():
    emit('config_data', memory.config)

@socketio.on('update_config')
def on_update_config(data):
    global ai, voice
    try:
        memory.save_config(data)
        if "gemini_api_key" in data:
            ai = AIEngine(data["gemini_api_key"], memory)
        if "elevenlabs_api_key" in data or "voice_id" in data:
            voice = VoiceEngine(
                api_key=memory.get_config("elevenlabs_api_key"),
                voice_id=memory.get_config("voice_id", "EXAVITQu4vr4xnNLMQyz")
            )
        emit('update_config_success', {"message": "Configuration updated successfully!"})
        print("[SERVER] Configuration updated and engines re-initialized.")
    except Exception as e:
        emit('update_config_error', {"message": f"Failed to update config: {str(e)}"})
        print(f"[SERVER] Config update error: {e}")

# ─── MULTI-SESSION CHAT HISTORY HANDLERS ───
@socketio.on('get_conversations')
def on_get_conversations():
    emit('conversations_list', {
        'conversations': memory.get_conversations_list(),
        'current_session_id': memory.get_current_session_id()
    })

@socketio.on('new_conversation')
def on_new_conversation():
    new_id = memory.create_new_session()
    ai._load_history() # Reset AI's chat history context
    emit('new_conversation_created', {
        'session_id': new_id,
        'conversations': memory.get_conversations_list()
    })
    emit('conversation_history', {'history': []})

@socketio.on('switch_conversation')
def on_switch_conversation(data):
    session_id = data.get('session_id')
    memory.set_current_session(session_id)
    ai._load_history() # Load new context
    session = memory.get_current_session()
    emit('conversation_history', {
        'history': session.get('history', []),
        'session_id': session_id
    })

@socketio.on('delete_conversation')
def on_delete_conversation(data):
    session_id = data.get('session_id')
    memory.delete_session(session_id)
    ai._load_history() # Refresh active context
    emit('conversations_list', {
        'conversations': memory.get_conversations_list(),
        'current_session_id': memory.get_current_session_id()
    })
    session = memory.get_current_session()
    emit('conversation_history', {
        'history': session.get('history', []),
        'session_id': memory.get_current_session_id()
    })

@socketio.on('user_command')
def handle_command(data):
    command = data.get('command', '').lower()
    print(f"\n[SERVER] Received Command: '{command}'")
    
    response_text = ""
    
    try:
        # 1. Routing & Processing
        if "open " in command:
            app_name = command.replace("open ", "").strip()
            print(f"[SERVER] Routing to: Open App ({app_name})")
            response_text = automation.open_app(app_name)
            
        elif "volume" in command:
            print(f"[SERVER] Routing to: Volume Control")
            try:
                level = int(''.join(filter(str.isdigit, command)))
                response_text = automation.set_volume(level)
            except:
                response_text = "Could you tell me the volume level? Like 'set volume to 50'."
                
        elif "search" in command:
            query = command.replace("search ", "").strip()
            print(f"[SERVER] Routing to: Web Search ({query})")
            response_text = automation.search_web(query)
            
        elif "screenshot" in command or "read screen" in command:
            print(f"[SERVER] Routing to: Screen Analysis")
            emit('ai_response', {'message': 'Screen analyzing...'})
            screenshot_path = automation.take_screenshot()
            response_text = ai.analyze_screen(screenshot_path)
            
        elif "coding mode" in command:
            print(f"[SERVER] Routing to: Mode Switch (Coding)")
            response_text = ai.set_mode("coding")
            emit('mode_change', {'mode': 'coding'})
            
        elif "standard mode" in command or "exit coding" in command:
            print(f"[SERVER] Routing to: Mode Switch (Standard)")
            response_text = ai.set_mode("standard")
            emit('mode_change', {'mode': 'standard'})
            
        else:
            # Default to AI chat (Streaming)
            print(f"[SERVER] Routing to: AI Engine (Gemini) [STREAMING]")
            full_response = ""
            attachments = data.get('attachments', [])
            for chunk in ai.get_streaming_response(command, attachments=attachments):
                full_response += chunk
                emit('ai_chunk', {'chunk': chunk})
                socketio.sleep(0) # Yield to ensure immediate emission
            
            response_text = full_response
            
            # Auto-generate title for a new chat
            current_session = memory.get_current_session()
            if current_session.get('title') in ["New Chat", "Default Chat"] and len(current_session.get('history', [])) <= 2:
                raw_command = data.get('command', '').strip()
                new_title = raw_command[:30] + "..." if len(raw_command) > 30 else raw_command
                new_title = new_title.strip().capitalize()
                memory.update_session_title(memory.get_current_session_id(), new_title)
                emit('conversations_list', {
                    'conversations': memory.get_conversations_list(),
                    'current_session_id': memory.get_current_session_id()
                })

        # 2. Final Response Emission (also used for TTS trigger)
        if response_text:
            print(f"[SERVER] Sending Final Response: {response_text[:50]}...")
            emit('ai_response', {'message': response_text})
            
            # Generate and send ElevenLabs audio if available (DISABLED BY USER)
            # audio_data = voice.get_audio_data(response_text)
            # if audio_data:
            #     emit('audio_response', {'audio': audio_data})
        
    except Exception as e:
        error_msg = f"Critical Error in Command Handler: {str(e)}"
        print(f"[SERVER] {error_msg}")
        emit('ai_response', {'message': f"Oops, something went wrong: {str(e)}"})

# ─── BACKEND SPEECH RECOGNITION (ChatGPT-Style) ───
is_listening = False
current_mic_session = None

def speech_recognition_thread(sid, session_id):
    global is_listening, current_mic_session
    try:
        r = sr.Recognizer()
        r.dynamic_energy_threshold = True
        r.pause_threshold = 0.8
        
        m = sr.Microphone()
        with m as source:
            print(f"[SR Thread {session_id}] Calibrating mic for ambient noise...")
            r.adjust_for_ambient_noise(source, duration=0.5)
            
            if current_mic_session != session_id:
                print(f"[SR Thread {session_id}] Aborted during calibration.")
                return
            
            print(f"[SR Thread {session_id}] Listening...")
            audio = r.listen(source, timeout=8, phrase_time_limit=15)
            
            if current_mic_session != session_id:
                print(f"[SR Thread {session_id}] Aborted during listening.")
                return
            
            print(f"[SR Thread {session_id}] Transcribing...")
            text = r.recognize_google(audio)
            
            if current_mic_session != session_id:
                print(f"[SR Thread {session_id}] Aborted during transcription.")
                return
            
            print(f"[SR Thread {session_id}] Result: '{text}'")
            socketio.emit('mic_result', {'text': text}, to=sid)
            
    except sr.WaitTimeoutError:
        print(f"[SR Thread {session_id}] Timeout: No speech detected.")
        if current_mic_session == session_id:
            socketio.emit('mic_error', {'error': 'No speech detected.'}, to=sid)
    except sr.UnknownValueError:
        print(f"[SR Thread {session_id}] Unknown value: Speech unintelligible.")
        if current_mic_session == session_id:
            socketio.emit('mic_error', {'error': 'Could not understand audio.'}, to=sid)
    except Exception as e:
        print(f"[SR Thread {session_id}] Error: {str(e)}")
        if current_mic_session == session_id:
            socketio.emit('mic_error', {'error': str(e)}, to=sid)
    finally:
        if current_mic_session == session_id:
            is_listening = False
            current_mic_session = None
            socketio.emit('mic_stopped', to=sid)
            print(f"[SR Thread {session_id}] Finished and cleaned up.")

@socketio.on('start_mic')
def on_start_mic():
    global is_listening, current_mic_session
    print("[SERVER] start_mic socket event received.")
    
    if is_listening:
        print("[SERVER] Mic is already active. Aborting previous session.")
        current_mic_session = None
        is_listening = False
        socketio.emit('mic_stopped', to=request.sid)
        time.sleep(0.1)
        
    is_listening = True
    current_mic_session = time.time()
    socketio.emit('mic_started', to=request.sid)
    
    t = threading.Thread(
        target=speech_recognition_thread, 
        args=(request.sid, current_mic_session), 
        daemon=True
    )
    t.start()

@socketio.on('stop_mic')
def on_stop_mic():
    global is_listening, current_mic_session
    print("[SERVER] stop_mic socket event received.")
    current_mic_session = None
    is_listening = False
    socketio.emit('mic_stopped', to=request.sid)

def system_monitor_thread():
    """Background thread for system stats."""
    while True:
        try:
            stats = monitor.get_stats()
            socketio.emit('system_stats', stats)
        except Exception as e:
            print(f"[MONITOR] Error: {e}")
        time.sleep(2)

if __name__ == '__main__':
    # Start system monitor thread
    monitor_thread = threading.Thread(target=system_monitor_thread, daemon=True)
    monitor_thread.start()
    
    print("\n" + "="*40)
    print(" CLOVE AI SERVER - FULL DEBUG MODE")
    print("="*40)
    print("Running on http://127.0.0.1:5000")
    print("="*40 + "\n")
    
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
