import docker
import json

client = docker.from_env()

print("Listening for Docker events...")

for event in client.events(decode=True):
    print(json.dumps(event, indent=2))
