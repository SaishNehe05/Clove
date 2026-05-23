import speech_recognition as sr
import time

print("Initializing Recognizer...")
r = sr.Recognizer()
try:
    print("Listing microphone sources...")
    mics = sr.Microphone.list_microphone_names()
    print("Found mics:", mics)
    
    print("Opening Microphone...")
    with sr.Microphone() as source:
        print("Adjusting for ambient noise (please be quiet)...")
        r.adjust_for_ambient_noise(source, duration=1)
        print("Listening for 3 seconds...")
        audio = r.record(source, duration=3)
        print("Recording finished. Transcribing...")
        text = r.recognize_google(audio)
        print("Google Speech Recognition thinks you said:", text)
except Exception as e:
    print("An error occurred during microphone test:", e)
