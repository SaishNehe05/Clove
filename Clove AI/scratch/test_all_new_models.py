from google import genai

api_key = "AIzaSyBlPa72yYeQ90InDQOcD1cVaf6rOo3MzLI"

models_to_test = [
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash'
]

client = genai.Client(api_key=api_key)

for model_name in models_to_test:
    print(f"Testing model: {model_name}...")
    try:
        response = client.models.generate_content(
            model=model_name,
            contents="Hello! Give me a 1-word greeting."
        )
        print(f"SUCCESS for {model_name}!")
        print(f"Response: {response.text.strip()}\n")
    except Exception as e:
        print(f"ERROR for {model_name}: {e}\n")
