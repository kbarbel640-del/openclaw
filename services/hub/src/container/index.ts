import type { ContainerProvider } from "./provider.js";

let provider: ContainerProvider | null = null;

export async function initProvider(): Promise<void> {
  const backend = process.env.CONTAINER_PROVIDER || "docker";

  switch (backend) {
    case "docker": {
      const { DockerProvider } = await import("./docker-provider.js");
      provider = new DockerProvider();
      break;
    }
    case "ecs": {
      const { EcsProvider } = await import("./ecs-provider.js");
      provider = new EcsProvider();
      break;
    }
    default:
      throw new Error(`Unknown CONTAINER_PROVIDER: ${backend}`);
  }

  console.log(`Container provider initialised: ${backend}`);
}

export function getProvider(): ContainerProvider {
  if (!provider) {
    throw new Error("Container provider not initialised — call initProvider() first");
  }
  return provider;
}
