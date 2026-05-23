from google import genai

api_key = "AIzaSyBlPa72yYeQ90InDQOcD1cVaf6rOo3MzLI"
print(f"Testing Gemini Key with NEW SDK: {api_key[:10]}...")

try:
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model='gemini-2.0-flash-lite',
        contents="Hello! Give me a 3-word response."
    )
    print("Success!")
    print(f"Response: {response.text}")
except Exception as e:
    print("Error occurred:")
    print(e)
