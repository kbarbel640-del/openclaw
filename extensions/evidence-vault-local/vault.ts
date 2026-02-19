import path from 'node:path';
import fs from 'fs-extra';
import { createHash } from 'node:crypto';
import { Database } from 'sqlite';
import { open } from 'sqlite';
import JSZip from 'jszip';

// --- Types ---
export type EvidenceItem = {
  evidence_id: string;
  case_id: string;
  sha256: string;
  size: number;
  mime: string;
  received_at: string;
  object_path: string;
  original_name?: string;
};

export type AuditEvent = {
  event_id?: number;
  ts: string;
  event_type: string;
  case_id: string;
  evidence_id?: string;
  actor: string;
  details_redacted: string;
};

// --- Vault Class ---
export class EvidenceVault {
  private db: Database;
  private vaultRoot: string;
  private auditLogPath: string;

  private constructor(db: Database, vaultRoot: string) {
    this.db = db;
    this.vaultRoot = vaultRoot;
    this.auditLogPath = path.join(vaultRoot, 'audit', 'audit.jsonl');
  }

  public static async create(vaultRoot: string): Promise<EvidenceVault> {
    // Security: Ensure vaultRoot is absolute and resolved
    const absoluteVaultRoot = path.resolve(vaultRoot);
    await fs.ensureDir(absoluteVaultRoot);
    await fs.ensureDir(path.join(absoluteVaultRoot, 'objects'));
    await fs.ensureDir(path.join(absoluteVaultRoot, 'audit'));
    await fs.ensureDir(path.join(absoluteVaultRoot, 'manifests'));
    await fs.ensureDir(path.join(absoluteVaultRoot, 'exports'));

    const dbPath = path.join(absoluteVaultRoot, 'catalog.db');
    const db = await open({
        filename: dbPath,
        driver: (await import('sqlite3')).default.Database
    });

    await this.initSchema(db);
    return new EvidenceVault(db, absoluteVaultRoot);
  }

  private static async initSchema(db: Database): Promise<void> {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS cases (
        case_id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sensitivity TEXT,
        retention_policy TEXT,
        status TEXT DEFAULT 'active'
      );
      CREATE TABLE IF NOT EXISTS evidence_items (
        evidence_id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        size INTEGER NOT NULL,
        mime TEXT NOT NULL,
        received_at TEXT NOT NULL,
        object_path TEXT NOT NULL,
        original_name TEXT,
        FOREIGN KEY(case_id) REFERENCES cases(case_id)
      );
      CREATE TABLE IF NOT EXISTS audit_events (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        event_type TEXT NOT NULL,
        case_id TEXT NOT NULL,
        evidence_id TEXT,
        actor TEXT NOT NULL,
        details_redacted TEXT NOT NULL
      );
    `);
  }

  private async logAudit(event: Omit<AuditEvent, 'event_id' | 'ts'>): Promise<void> {
    const ts = new Date().toISOString();
    const fullEvent = { ts, ...event };

    // Security: Using prepared statements for audit log
    await this.db.run(
      'INSERT INTO audit_events (ts, event_type, case_id, evidence_id, actor, details_redacted) VALUES (?, ?, ?, ?, ?, ?)',
      [ts, event.event_type, event.case_id, event.evidence_id || null, event.actor, event.details_redacted]
    );
    await fs.appendFile(this.auditLogPath, JSON.stringify(fullEvent) + '\n');
  }

  async ingest(params: {
    filePath: string;
    caseId: string;
    actor: string;
    sensitivity?: string;
    retention?: string;
  }): Promise<EvidenceItem> {
    const { filePath, caseId, actor, sensitivity = 'medium', retention = '7y' } = params;

    // Security: Path Sanitization
    const resolvedPath = path.resolve(filePath);
    if (!await fs.pathExists(resolvedPath)) {
        throw new Error(`Source file not found: ${filePath}`);
    }

    const fileBuffer = await fs.readFile(resolvedPath);
    const hash = createHash('sha256').update(fileBuffer).digest('hex');
    const size = fileBuffer.length;
    const objectPath = path.join(this.vaultRoot, 'objects', hash);
    const originalName = path.basename(resolvedPath);

    // Write-once implementation (immutable objects)
    if (!(await fs.pathExists(objectPath))) {
      await fs.writeFile(objectPath, fileBuffer);
    }

    // Use prepared statements for Case and Item
    await this.db.run(
      'INSERT OR IGNORE INTO cases (case_id, created_at, updated_at, sensitivity, retention_policy) VALUES (?, ?, ?, ?, ?)',
      [caseId, new Date().toISOString(), new Date().toISOString(), sensitivity, retention]
    );

    const evidenceId = createHash('sha256').update(caseId + hash + Date.now()).digest('hex').substring(0, 16);
    const receivedAt = new Date().toISOString();
    const mime = 'application/octet-stream';

    await this.db.run(
      'INSERT INTO evidence_items (evidence_id, case_id, sha256, size, mime, received_at, object_path, original_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [evidenceId, caseId, hash, size, mime, receivedAt, objectPath, originalName]
    );

    await this.logAudit({
      event_type: 'INGEST',
      case_id: caseId,
      evidence_id: evidenceId,
      actor: actor,
      details_redacted: `Ingested file ${originalName} (SHA256: ${hash.substring(0,8)}...)`
    });

    return { evidence_id: evidenceId, case_id: caseId, sha256: hash, size, mime, received_at: receivedAt, object_path: objectPath, original_name: originalName };
  }

  async verify(evidenceId: string, actor: string): Promise<{ ok: boolean; reason?: string }> {
    // Security: Prepared statement
    const item = await this.db.get('SELECT * FROM evidence_items WHERE evidence_id = ?', [evidenceId]);
    if (!item) return { ok: false, reason: 'Evidence ID not found' };

    const fileBuffer = await fs.readFile(item.object_path);
    const currentHash = createHash('sha256').update(fileBuffer).digest('hex');
    const ok = currentHash === item.sha256;

    await this.logAudit({
      event_type: 'VERIFY',
      case_id: item.case_id,
      evidence_id: evidenceId,
      actor: actor,
      details_redacted: ok ? 'Integrity verified' : 'INTEGRITY FAILURE: Hash mismatch'
    });
    return ok ? { ok: true } : { ok: false, reason: 'Hash mismatch' };
  }

  async getManifest(caseId: string): Promise<any> {
    const caseData = await this.db.get('SELECT * FROM cases WHERE case_id = ?', [caseId]);
    if (!caseData) return null;

    const items = await this.db.all('SELECT * FROM evidence_items WHERE case_id = ?', [caseId]);
    const manifest = {
      caseId: caseData.case_id,
      createdAt: caseData.created_at,
      updatedAt: caseData.updated_at,
      sensitivity: caseData.sensitivity,
      retentionPolicy: caseData.retention_policy,
      items: items.map(i => ({
        evidenceId: i.evidence_id,
        originalName: i.original_name,
        sha256: i.sha256,
        size: i.size,
        mime: i.mime,
        receivedAt: i.received_at
      }))
    };
    const manifestPath = path.join(this.vaultRoot, 'manifests', `${caseId}.json`);
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });
    return manifest;
  }

  async exportCase(caseId: string, actor: string): Promise<{ zipPath: string; sha256: string }> {
    const manifest = await this.getManifest(caseId);
    if (!manifest) throw new Error('Case not found');

    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    const items = await this.db.all('SELECT * FROM evidence_items WHERE case_id = ?', [caseId]);
    for (const item of items) {
        const content = await fs.readFile(item.object_path);
        const fileName = item.original_name || `evidence_${item.evidence_id}.bin`;
        zip.file(`evidence/${fileName}`, content);
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const zipHash = createHash('sha256').update(zipBuffer).digest('hex');
    const zipName = `${caseId}_export_${new Date().getTime()}.zip`;
    const zipPath = path.join(this.vaultRoot, 'exports', zipName);

    await fs.writeFile(zipPath, zipBuffer);

    await this.logAudit({
      event_type: 'EXPORT',
      case_id: caseId,
      actor: actor,
      details_redacted: `Exported case to ${zipName} (SHA256: ${zipHash.substring(0,8)}...)`
    });

    return { zipPath, sha256: zipHash };
  }
}
