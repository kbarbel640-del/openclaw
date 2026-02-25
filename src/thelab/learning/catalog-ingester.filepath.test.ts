import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, test } from "vitest";
import { CatalogIngester } from "./catalog-ingester.js";

describe("CatalogIngester.extractPhotoByFilePath", () => {
  test("returns a photo record when the absolute path matches", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "thelab-lrcat-"));
    const lrcatPath = path.join(tmpDir, "test.lrcat");

    // Create a minimal SQLite catalog with just the tables/columns our query uses.
    const db = new DatabaseSync(lrcatPath);
    db.exec(`
      CREATE TABLE Adobe_images (
        id_local INTEGER PRIMARY KEY,
        rootFile INTEGER,
        rating INTEGER,
        pick INTEGER,
        captureTime TEXT
      );
      CREATE TABLE AgLibraryFile (
        id_local INTEGER PRIMARY KEY,
        folder INTEGER,
        baseName TEXT,
        pathFromRoot TEXT
      );
      CREATE TABLE AgLibraryFolder (
        id_local INTEGER PRIMARY KEY,
        rootFolder INTEGER
      );
      CREATE TABLE AgLibraryRootFolder (
        id_local INTEGER PRIMARY KEY,
        absolutePath TEXT
      );
      CREATE TABLE Adobe_imageProperties (
        image INTEGER,
        isoSpeedRating REAL,
        focalLength REAL,
        aperture REAL,
        shutterSpeed REAL,
        flashFired INTEGER,
        cameraModelRef TEXT,
        lensRef TEXT,
        gpsLatitude REAL,
        gpsLongitude REAL,
        dateDay INTEGER
      );
      CREATE TABLE Adobe_imageDevelopSettings (
        image INTEGER,
        settingsID INTEGER,
        text TEXT,
        digest TEXT
      );
    `);

    const root = "/Volumes/TEST/";
    const rel = "Shoots/2026-02-18/";
    const name = "DSC_0001.NEF";
    const abs = path.join(root, rel, name);

    db.prepare("INSERT INTO AgLibraryRootFolder (id_local, absolutePath) VALUES (?, ?)").run(
      1,
      root,
    );
    db.prepare("INSERT INTO AgLibraryFolder (id_local, rootFolder) VALUES (?, ?)").run(10, 1);
    db.prepare(
      "INSERT INTO AgLibraryFile (id_local, folder, baseName, pathFromRoot) VALUES (?, ?, ?, ?)",
    ).run(100, 10, name, rel);
    db.prepare(
      "INSERT INTO Adobe_images (id_local, rootFile, rating, pick, captureTime) VALUES (?, ?, ?, ?, ?)",
    ).run(200, 100, 0, 0, "2026-02-18T10:00:00Z");
    db.prepare(
      "INSERT INTO Adobe_imageProperties (image, isoSpeedRating, focalLength, aperture, shutterSpeed, flashFired, cameraModelRef, lensRef, gpsLatitude, gpsLongitude, dateDay) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(200, 100, 50, 1.8, 0.01, 0, "Camera", "Lens", null, null, 0);
    db.prepare(
      "INSERT INTO Adobe_imageDevelopSettings (image, settingsID, text, digest) VALUES (?, ?, ?, ?)",
    ).run(200, 1, `<?xml version="1.0"?>\n<x:xmpmeta crs:Exposure2012="0.5"></x:xmpmeta>`, "x");

    db.close();

    const ingester = new CatalogIngester(lrcatPath);
    ingester.open();
    const photo = ingester.extractPhotoByFilePath(abs);
    ingester.close();

    expect(photo).not.toBeNull();
    expect(photo?.filePath).toBe(abs);
    expect(photo?.hasBeenEdited).toBe(true);
  });
});
