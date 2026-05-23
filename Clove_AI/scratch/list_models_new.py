from google import genai

api_key = "AIzaSyBlPa72yYeQ90InDQOcD1cVaf6rOo3MzLI"

try:
    client = genai.Client(api_key=api_key)
    for model in client.models.list():
        print(model.name)
except Exception as e:
    print("Error:")
    print(e)
