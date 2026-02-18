/**
 * Streaming File Reader System
 * Memory-efficient large file reading with progressive loading and caching
 */

import fs from "node:fs";
import fsAsync from "node:fs/promises";
import path from "node:path";
import { EventEmitter } from "node:events";

export interface FileChunk {
  chunkId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  sizeBytes: number;
  isLast: boolean;
}

export interface FileReadProgress {
  filePath: string;
  totalSize: number;
  bytesRead: number;
  linesRead: number;
  totalLines: number;
  percentage: number;
  status: "pending" | "reading" | "completed" | "failed" | "cancelled";
}

export interface StreamingReadOptions {
  filePath: string;
  startLine?: number;
  maxLines?: number;
  maxBytes?: number;
  encoding?: BufferEncoding;
  signal?: AbortSignal;
  onProgress?: (progress: FileReadProgress) => void;
}

export interface FileMetadata {
  path: string;
  size: number;
  created: Date;
  modified: Date;
  isFile: boolean;
  isDirectory: boolean;
  extension: string;
}

export interface ReadCacheEntry {
  content: string;
  size: number;
  accessTime: number;
  lineCount: number;
}

type ProgressListener = (progress: FileReadProgress) => void;

export class StreamingFileReader extends EventEmitter {
  private static instance: StreamingFileReader | null = null;
  private readCache = new Map<string, ReadCacheEntry>();
  private activeReads = new Map<string, FileReadProgress>();
  private readonly MAX_CACHE_SIZE_MB = 50;
  private readonly DEFAULT_MAX_LINES = 1000;
  private readonly DEFAULT_MAX_BYTES = 512 * 1024;
  private readonly LINE_BUFFER = 1024;

  private constructor() {
    super();
  }

  static getInstance(): StreamingFileReader {
    if (!StreamingFileReader.instance) {
      StreamingFileReader.instance = new StreamingFileReader();
    }
    return StreamingFileReader.instance;
  }

  async read(options: StreamingReadOptions): Promise<FileChunk> {
    const { filePath, startLine = 1, maxLines, maxBytes, encoding = "utf-8", signal, onProgress } = options;

    const exists = await this.fileExists(filePath);
    if (!exists) {
      throw new Error(`File not found: ${filePath}`);
    }

    const metadata = await this.getMetadata(filePath);
    const progress: FileReadProgress = {
      filePath,
      totalSize: metadata.size,
      bytesRead: 0,
      linesRead: 0,
      totalLines: 0,
      percentage: 0,
      status: "pending",
    };

    this.activeReads.set(filePath, progress);

    try {
      progress.status = "reading";
      this.emitProgress(progress, onProgress);

      const actualMaxLines = maxLines ?? this.DEFAULT_MAX_LINES;
      const actualMaxBytes = maxBytes ?? this.DEFAULT_MAX_BYTES;
      const cacheKey = this.getCacheKey(filePath, startLine, actualMaxLines);
      const cached = this.getFromCache(cacheKey);

      if (cached) {
        const chunk: FileChunk = {
          chunkId: cacheKey,
          filePath,
          startLine,
          endLine: startLine + cached.lineCount - 1,
          content: cached.content,
          sizeBytes: cached.size,
          isLast: true,
        };
        progress.status = "completed";
        progress.percentage = 100;
        this.emitProgress(progress, onProgress);
        return chunk;
      }

      const content = await this.readFileRange(
        filePath,
        startLine,
        actualMaxLines,
        actualMaxBytes,
        encoding,
        progress,
        signal,
      );

      const lines = content.split("\n");
      const endLine = startLine + lines.length - 1;
      const isLast = progress.bytesRead >= progress.totalSize || lines.length < actualMaxLines;

      const chunk: FileChunk = {
        chunkId: cacheKey,
        filePath,
        startLine,
        endLine,
        content,
        sizeBytes: Buffer.byteLength(content, encoding),
        isLast,
      };

      this.addToCache(cacheKey, content, chunk.sizeBytes, lines.length);

      progress.status = "completed";
      progress.percentage = 100;
      this.emitProgress(progress, onProgress);

      return chunk;
    } catch (error) {
      progress.status = "failed";
      this.emitProgress(progress, onProgress);
      throw error;
    } finally {
      this.activeReads.delete(filePath);
    }
  }

  async readChunked(
    filePath: string,
    chunkSize: number,
    callback: (chunk: FileChunk) => Promise<void> | void,
    options?: Partial<StreamingReadOptions>,
  ): Promise<void> {
    let startLine = options?.startLine ?? 1;
    let isLast = false;

    while (!isLast) {
      const chunk = await this.read({
        filePath,
        startLine,
        maxLines: chunkSize,
        ...options,
      });

      await callback(chunk);

      isLast = chunk.isLast;
      startLine = chunk.endLine + 1;
    }
  }

  async getMetadata(filePath: string): Promise<FileMetadata> {
    const stats = await fsAsync.stat(filePath);
    return {
      path: filePath,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      extension: path.extname(filePath).toLowerCase(),
    };
  }

  async getLineCount(filePath: string): Promise<number> {
    const cacheKey = `${filePath}:lineCount`;
    const cached = this.readCache.get(cacheKey);
    if (cached) {
      return cached.lineCount;
    }

    let lineCount = 0;
    const buffer = Buffer.alloc(this.LINE_BUFFER);
    const handle = await fsAsync.open(filePath, "r");

    try {
      while (true) {
        const { bytesRead } = await handle.read(buffer, 0, this.LINE_BUFFER, null);
        if (bytesRead === 0) {
          break;
        }
        for (let i = 0; i < bytesRead; i++) {
          if (buffer[i] === 10) {
            lineCount++;
          }
        }
      }
    } finally {
      await handle.close();
    }

    this.addToCache(cacheKey, "", 0, lineCount);
    return lineCount;
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fsAsync.access(filePath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  getProgress(filePath: string): FileReadProgress | undefined {
    return this.activeReads.get(filePath);
  }

  cancel(filePath: string): boolean {
    const progress = this.activeReads.get(filePath);
    if (progress && progress.status === "reading") {
      progress.status = "cancelled";
      return true;
    }
    return false;
  }

  clearCache(): void {
    this.readCache.clear();
  }

  getCacheSize(): number {
    let totalSize = 0;
    for (const entry of this.readCache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  subscribe(filePath: string, listener: ProgressListener): () => void {
    this.on(`progress:${filePath}`, listener);
    return () => this.off(`progress:${filePath}`, listener);
  }

  private async readFileRange(
    filePath: string,
    startLine: number,
    maxLines: number,
    maxBytes: number,
    encoding: BufferEncoding,
    progress: FileReadProgress,
    signal?: AbortSignal,
  ): Promise<string> {
    const lines: string[] = [];
    let currentLine = 1;
    let bytesRead = 0;
    const handle = await fsAsync.open(filePath, "r");

    try {
      const bufferSize = 64 * 1024;
      const buffer = Buffer.alloc(bufferSize);

      while (lines.length < maxLines && bytesRead < maxBytes) {
        if (signal?.aborted) {
          throw new Error("Read cancelled");
        }

        const result = await handle.read(buffer, 0, bufferSize, null);
        if (result.bytesRead === 0) {
          break;
        }

        const chunk = buffer.toString(encoding, 0, result.bytesRead);
        const chunkLines = chunk.split("\n");

        for (let i = 0; i < chunkLines.length; i++) {
          if (currentLine >= startLine && lines.length < maxLines) {
            const lineBytes = Buffer.byteLength(chunkLines[i], encoding);
            if (bytesRead + lineBytes > maxBytes && lines.length > 0) {
              break;
            }
            lines.push(chunkLines[i]);
            bytesRead += lineBytes + 1;
          }
          currentLine++;
        }

        progress.bytesRead = bytesRead;
        progress.linesRead = lines.length;
        progress.percentage = Math.floor((bytesRead / progress.totalSize) * 100);
        this.emit("progress", progress);
      }
    } finally {
      await handle.close();
    }

    return lines.join("\n");
  }

  private getCacheKey(filePath: string, startLine: number, maxLines?: number): string {
    return `${filePath}:${startLine}:${maxLines ?? "all"}`;
  }

  private getFromCache(cacheKey: string): ReadCacheEntry | undefined {
    const entry = this.readCache.get(cacheKey);
    if (entry) {
      entry.accessTime = Date.now();
    }
    return entry;
  }

  private addToCache(cacheKey: string, content: string, size: number, lineCount: number): void {
    const currentSize = this.getCacheSize();

    while (currentSize + size > this.MAX_CACHE_SIZE_MB * 1024 * 1024 && this.readCache.size > 0) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, entry] of this.readCache.entries()) {
        if (entry.accessTime < oldestTime) {
          oldestTime = entry.accessTime;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.readCache.delete(oldestKey);
      }
    }

    this.readCache.set(cacheKey, {
      content,
      size,
      accessTime: Date.now(),
      lineCount,
    });
  }

  private emitProgress(progress: FileReadProgress, listener?: ProgressListener): void {
    this.emit(`progress:${progress.filePath}`, progress);
    if (listener) {
      listener(progress);
    }
  }
}

export function getStreamingFileReader(): StreamingFileReader {
  return StreamingFileReader.getInstance();
}

export class FileReadManager {
  private static instance: FileReadManager | null = null;
  private reader = StreamingFileReader.getInstance();

  private constructor() {}

  static getInstance(): FileReadManager {
    if (!FileReadManager.instance) {
      FileReadManager.instance = new FileReadManager();
    }
    return FileReadManager.instance;
  }

  async readFile(filePath: string, options?: Partial<StreamingReadOptions>): Promise<string> {
    const chunk = await this.reader.read({ filePath, ...options });
    return chunk.content;
  }

  async getFileInfo(filePath: string): Promise<FileMetadata> {
    return this.reader.getMetadata(filePath);
  }

  async estimateTokens(filePath: string): Promise<number> {
    const content = await this.readFile(filePath);
    return Math.ceil(content.length / 4);
  }
}

export function getFileReadManager(): FileReadManager {
  return FileReadManager.getInstance();
}
