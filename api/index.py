import sys
import os
import json

# Add "Clove_AI" to the system path so we can import from core
clove_ai_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Clove_AI"))
sys.path.append(clove_ai_dir)

from flask import Flask, jsonify, request, Response, send_from_directory
from core.ai_engine import AIEngine
from core.automation import AutomationEngine
from core.memory_system import MemorySystem
from core.system_monitor import SystemMonitor
from core.voice_engine import VoiceEngine

app = Flask(__name__, static_folder=os.path.join(clove_ai_dir, 'static'), static_url_path='/static')

# Initialize Modules
memory = MemorySystem()
ai = AIEngine(memory.get_config("gemini_api_key"), memory)
automation = AutomationEngine()
monitor = SystemMonitor()
voice = VoiceEngine(
    api_key=memory.get_config("elevenlabs_api_key"),
    voice_id=memory.get_config("voice_id", "EXAVITQu4vr4xnNLMQyz")
)

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS,DELETE'
    return response

# Fallback index route
@app.route('/')
def home():
    return send_from_directory(clove_ai_dir, 'index.html')

# API Auth Routes
@app.route('/api/auth/login', methods=['POST', 'OPTIONS'])
def api_login():
    if request.method == 'OPTIONS': return '', 200
    data = request.json or {}
    result = memory.sign_in(data.get('email'), data.get('password'))
    return jsonify(result)

@app.route('/api/auth/signup', methods=['POST', 'OPTIONS'])
def api_signup():
    if request.method == 'OPTIONS': return '', 200
    data = request.json or {}
    result = memory.sign_up(data.get('name'), data.get('email'), data.get('password'))
    return jsonify(result)

@app.route('/api/auth/session', methods=['POST', 'OPTIONS'])
def api_session():
    if request.method == 'OPTIONS': return '', 200
    data = request.json or {}
    memory.set_user(data.get('user_id'))
    return jsonify({"success": True})

# Config Routes
@app.route('/api/config', methods=['GET', 'POST', 'OPTIONS'])
def api_config():
    if request.method == 'OPTIONS': return '', 200
    global ai, voice
    if request.method == 'POST':
        data = request.json or {}
        try:
            memory.save_config(data)
            if "gemini_api_key" in data:
                ai = AIEngine(data["gemini_api_key"], memory)
            if "elevenlabs_api_key" in data or "voice_id" in data:
                voice = VoiceEngine(
                    api_key=memory.get_config("elevenlabs_api_key"),
                    voice_id=memory.get_config("voice_id", "EXAVITQu4vr4xnNLMQyz")
                )
            return jsonify({"message": "Configuration updated successfully!"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    return jsonify(memory.config)

# Conversation Routes
@app.route('/api/conversations', methods=['GET', 'OPTIONS'])
def api_conversations():
    if request.method == 'OPTIONS': return '', 200
    return jsonify({
        'conversations': memory.get_conversations_list(),
        'current_session_id': memory.get_current_session_id()
    })

@app.route('/api/conversations/new', methods=['POST', 'OPTIONS'])
def api_new_conversation():
    if request.method == 'OPTIONS': return '', 200
    new_id = memory.create_new_session()
    ai._load_history()
    return jsonify({
        'session_id': new_id,
        'conversations': memory.get_conversations_list()
    })

@app.route('/api/conversations/switch', methods=['POST', 'OPTIONS'])
def api_switch_conversation():
    if request.method == 'OPTIONS': return '', 200
    data = request.json or {}
    session_id = data.get('session_id')
    memory.set_current_session(session_id)
    ai._load_history()
    session = memory.get_current_session()
    return jsonify({
        'history': session.get('history', []),
        'session_id': session_id
    })

@app.route('/api/conversations/delete', methods=['POST', 'OPTIONS'])
def api_delete_conversation():
    if request.method == 'OPTIONS': return '', 200
    data = request.json or {}
    session_id = data.get('session_id')
    memory.delete_session(session_id)
    ai._load_history()
    session = memory.get_current_session()
    return jsonify({
        'conversations': memory.get_conversations_list(),
        'current_session_id': memory.get_current_session_id(),
        'history': session.get('history', []),
        'session_id': memory.get_current_session_id()
    })

# System Stats Route
@app.route('/api/system_stats', methods=['GET', 'OPTIONS'])
def api_system_stats():
    if request.method == 'OPTIONS': return '', 200
    stats = monitor.get_stats()
    return jsonify(stats)

# User Command Route (SSE Streaming)
@app.route('/api/command', methods=['POST', 'OPTIONS'])
def api_command():
    if request.method == 'OPTIONS': return '', 200
    data = request.json or {}
    command = data.get('command', '').lower()
    attachments = data.get('attachments', [])
    
    print(f"[API] Received Command: '{command}'")
    
    if "open " in command:
        app_name = command.replace("open ", "").strip()
        response_text = automation.open_app(app_name)
        return jsonify({"message": response_text})
        
    elif "volume" in command:
        try:
            level = int(''.join(filter(str.isdigit, command)))
            response_text = automation.set_volume(level)
        except:
            response_text = "Could you tell me the volume level? Like 'set volume to 50'."
        return jsonify({"message": response_text})
        
    elif "search" in command:
        query = command.replace("search ", "").strip()
        response_text = automation.search_web(query)
        return jsonify({"message": response_text})
        
    elif "screenshot" in command or "read screen" in command:
        # Check cloud vs local
        if os.environ.get("VERCEL") or not os.name == 'nt':
            return jsonify({"message": "Screen analysis is a local desktop feature and is not available in the cloud."})
        # If running locally via this API
        try:
            screenshot_path = automation.take_screenshot()
            response_text = ai.analyze_screen(screenshot_path)
            return jsonify({"message": response_text})
        except Exception as e:
            return jsonify({"message": f"Screen analysis failed: {str(e)}"})
            
    elif "coding mode" in command:
        response_text = ai.set_mode("coding")
        return jsonify({"message": response_text, "mode": "coding"})
        
    elif "standard mode" in command or "exit coding" in command:
        response_text = ai.set_mode("standard")
        return jsonify({"message": response_text, "mode": "standard"})
        
    else:
        # Default AI Streaming response via Server-Sent Events (SSE)
        def generate_stream():
            full_response = ""
            try:
                for chunk in ai.get_streaming_response(command, attachments=attachments):
                    full_response += chunk
                    # Format standard SSE line
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                
                # Check new chat title auto-generation
                current_session = memory.get_current_session()
                title_updated = False
                if current_session.get('title') in ["New Chat", "Default Chat"] and len(current_session.get('history', [])) <= 2:
                    raw_command = data.get('command', '').strip()
                    new_title = raw_command[:30] + "..." if len(raw_command) > 30 else raw_command
                    new_title = new_title.strip().capitalize()
                    memory.update_session_title(memory.get_current_session_id(), new_title)
                    title_updated = True
                
                yield f"data: {json.dumps({'done': True, 'title_updated': title_updated, 'conversations': memory.get_conversations_list(), 'current_session_id': memory.get_current_session_id()})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                
        return Response(generate_stream(), mimetype='text/event-stream')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
