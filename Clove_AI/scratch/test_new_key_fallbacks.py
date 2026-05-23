from google import genai

api_key = "AIzaSyBlPa72yYeQ90InDQOcD1cVaf6rOo3MzLI"

for model_name in ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.0-pro']:
    print(f"Testing model: {model_name}...")
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=model_name,
            contents="Hello! Give me a 3-word response."
        )
        print(f"Success for {model_name}!")
        print(f"Response: {response.text}")
        break
    except Exception as e:
        print(f"Error for {model_name}: {e}\n")
