import fs from "node:fs/promises";
import path from "node:path";

const RAW_EXTENSIONS = new Set([
  ".cr2",
  ".cr3",
  ".nef",
  ".arw",
  ".orf",
  ".rw2",
  ".raf",
  ".dng",
  ".pef",
  ".srw",
  ".x3f",
  ".3fr",
  ".fff",
  ".iiq",
  ".rwl",
  ".raw",
  ".jpg",
  ".jpeg",
  ".tif",
  ".tiff",
  ".png",
]);

/**
 * Manages the image processing queue.
 * Scans a folder for supported image files and maintains processing order.
 */
export class ImageQueue {
  private images: string[] = [];
  private currentIndex = 0;

  async loadFromFolder(folderPath: string): Promise<number> {
    const resolvedPath = folderPath.replace(/^~/, process.env.HOME ?? "~");

    try {
      await fs.access(resolvedPath);
    } catch {
      throw new Error(`Folder not found: ${resolvedPath}`);
    }

    const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
    this.images = entries
      .filter((entry) => {
        if (!entry.isFile()) {
          return false;
        }
        const ext = path.extname(entry.name).toLowerCase();
        return RAW_EXTENSIONS.has(ext);
      })
      .map((entry) => path.join(resolvedPath, entry.name))
      .toSorted();

    this.currentIndex = 0;
    return this.images.length;
  }

  loadFromPaths(paths: string[]): void {
    this.images = [...paths];
    this.currentIndex = 0;
  }

  getAll(): string[] {
    return [...this.images];
  }

  getNext(): string | null {
    if (this.currentIndex >= this.images.length) {
      return null;
    }
    return this.images[this.currentIndex];
  }

  advance(): void {
    this.currentIndex++;
  }

  getCurrent(): string | null {
    if (this.currentIndex >= this.images.length) {
      return null;
    }
    return this.images[this.currentIndex];
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  getTotal(): number {
    return this.images.length;
  }

  isComplete(): boolean {
    return this.currentIndex >= this.images.length;
  }

  /**
   * Resume from a specific index (for crash recovery).
   */
  resumeFrom(index: number): void {
    this.currentIndex = Math.min(index, this.images.length);
  }

  getProgress(): { current: number; total: number; percent: number } {
    const percent =
      this.images.length > 0 ? Math.round((this.currentIndex / this.images.length) * 100) : 0;
    return {
      current: this.currentIndex,
      total: this.images.length,
      percent,
    };
  }
}
