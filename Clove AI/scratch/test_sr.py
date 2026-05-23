import sys
try:
    import speech_recognition as sr
    print("speech_recognition imported successfully")
except Exception as e:
    print("Failed to import speech_recognition:", e)

try:
    import pyaudio
    print("pyaudio imported successfully")
except Exception as e:
    print("Failed to import pyaudio:", e)
