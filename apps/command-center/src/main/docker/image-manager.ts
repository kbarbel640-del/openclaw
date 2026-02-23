/**
 * Image Manager — pull, inspect, and verify OpenClaw container images.
 *
 * User-facing label: "Package" (never "Docker image").
 * All image operations stream progress events so the UI can show feedback.
 */

import type Dockerode from "dockerode";
import type { DockerEngineClient } from "./engine-client.js";

export interface PullProgressEvent {
  status: string;
  progressDetail?: { current?: number; total?: number };
  id?: string;
}

export interface ImageSummary {
  id: string;
  repoTags: string[];
  sizeBytes: number;
  created: number;
  digest: string;
}

export type PullProgressCallback = (event: PullProgressEvent) => void;

export class ImageManager {
  constructor(private readonly client: DockerEngineClient) {}

  /**
   * Pull an image and stream progress events to the callback.
   * Resolves when the pull is fully complete.
   */
  async pull(imageName: string, onProgress?: PullProgressCallback): Promise<void> {
    const stream = await this.client.pullImage(imageName);
    await this.followProgress(stream, onProgress);
  }

  /**
   * Ensure an image is present locally; pull it if not.
   * Returns true if a pull was performed, false if already present.
   */
  async ensure(imageName: string, onProgress?: PullProgressCallback): Promise<boolean> {
    const exists = await this.client.imageExists(imageName);
    if (exists) { return false; }
    await this.pull(imageName, onProgress);
    return true;
  }

  /**
   * List all locally available OpenClaw images (tagged openclaw/*).
   */
  async list(): Promise<ImageSummary[]> {
    const images = await this.client.listImages();
    return images
      .filter((img) =>
        (img.RepoTags ?? []).some(
          (tag) => tag.startsWith("openclaw/") || tag.startsWith("openclaw:"),
        ),
      )
      .map((img) => this.toSummary(img));
  }

  /**
   * Inspect a specific image by name/tag.
   */
  async inspect(imageName: string): Promise<Dockerode.ImageInspectInfo> {
    return this.client.getEngine().getImage(imageName).inspect();
  }

  /**
   * Get the digest (sha256) of an image for integrity checking.
   */
  async getDigest(imageName: string): Promise<string | null> {
    try {
      const info = await this.inspect(imageName);
      return info.RepoDigests?.[0] ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Remove an image by name. Force-removes even if tagged.
   */
  async remove(imageName: string, force = false): Promise<void> {
    await this.client.getEngine().getImage(imageName).remove({ force });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private followProgress(
    stream: NodeJS.ReadableStream,
    onProgress?: PullProgressCallback,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const docker = this.client.getEngine();
      docker.modem.followProgress(
        stream,
        (err: Error | null) => {
          if (err) { reject(err); } else { resolve(); }
        },
        (event: PullProgressEvent) => {
          onProgress?.(event);
        },
      );
    });
  }

  private toSummary(img: Dockerode.ImageInfo): ImageSummary {
    return {
      id: img.Id,
      repoTags: img.RepoTags ?? [],
      sizeBytes: img.Size,
      created: img.Created,
      digest: img.Id, // short fallback; use getDigest() for repo digest
    };
  }
}
