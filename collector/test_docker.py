import docker

client = docker.from_env()

print("Docker connected!")

for container in client.containers.list(all=True):
    print(
        f"{container.name} | "
        f"{container.status} | "
        f"{container.image.tags}"
    )
