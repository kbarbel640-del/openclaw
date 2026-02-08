// Vector Search Module - sqlite-vec + transformers.js 整合
//
// Level 104: 真正的語義向量搜索
// - sqlite-vec: 高效 KNN 搜索
// - transformers.js: all-MiniLM-L6-v2 語義嵌入
// - 支持 fallback 到 hash-based 嵌入

import * as sqliteVec from "sqlite-vec";

// 向量維度（all-MiniLM-L6-v2 = 384）
const VECTOR_DIM = 384;

let vecLoaded = false;

// Transformer embedder (lazy loaded)
let embedder = null;
let embedderLoading = false;
let embedderFailed = false;

/**
 * 初始化 transformer embedder（lazy load）
 * 首次調用會下載模型（~90MB），之後使用緩存
 */
async function getEmbedder() {
  if (embedder) return embedder;
  if (embedderFailed) return null;
  if (embedderLoading) {
    // 等待其他調用完成
    while (embedderLoading) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return embedder;
  }

  embedderLoading = true;
  try {
    // 嘗試多個導入路徑
    let pipeline;
    try {
      // 優先使用本地安裝（容器內）
      const tf = await import("./node_modules/@huggingface/transformers/src/transformers.js");
      pipeline = tf.pipeline;
      console.log("[vector-search] Using local transformers.js installation");
    } catch {
      // 回退到全局安裝
      const tf = await import("@huggingface/transformers");
      pipeline = tf.pipeline;
      console.log("[vector-search] Using global transformers.js installation");
    }

    console.log(
      "[vector-search] Loading transformer model (first time may take ~90MB download)...",
    );
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      device: "cpu",
    });
    console.log("[vector-search] Transformer model loaded successfully");
    return embedder;
  } catch (err) {
    console.warn("[vector-search] Failed to load transformer:", err.message);
    console.warn("[vector-search] Falling back to hash-based embeddings");
    embedderFailed = true;
    return null;
  } finally {
    embedderLoading = false;
  }
}

/**
 * 初始化 sqlite-vec 擴展
 * @param {DatabaseSync} db - SQLite 數據庫實例
 * @returns {boolean} 是否成功載入
 */
export function initVectorSearch(db) {
  if (vecLoaded) return true;

  try {
    // 載入 sqlite-vec 擴展
    sqliteVec.load(db);

    // 驗證載入成功
    const result = db.prepare("SELECT vec_version() as version").get();
    console.log(`[vector-search] sqlite-vec ${result.version} loaded`);

    // 創建向量表（如果不存在）
    initVectorTables(db);

    vecLoaded = true;
    return true;
  } catch (err) {
    console.error("[vector-search] Failed to load sqlite-vec:", err.message);
    return false;
  }
}

/**
 * 創建向量搜索表
 * @param {DatabaseSync} db
 */
function initVectorTables(db) {
  // 消息向量表 - 使用 vec0 虛擬表
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS message_vectors USING vec0(
      embedding float[${VECTOR_DIM}]
    )
  `);

  // 知識庫向量表
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_vectors USING vec0(
      embedding float[${VECTOR_DIM}]
    )
  `);

  // 向量元數據表（關聯原始數據）
  db.exec(`
    CREATE TABLE IF NOT EXISTS vector_metadata (
      id INTEGER PRIMARY KEY,
      source_table TEXT NOT NULL,
      source_id INTEGER NOT NULL,
      text_preview TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_table, source_id)
    )
  `);

  console.log("[vector-search] Vector tables initialized");
}

/**
 * 生成語義嵌入向量（異步版本，使用 transformer）
 * 優先使用 transformers.js，失敗時 fallback 到 hash-based
 *
 * @param {string} text - 輸入文本
 * @returns {Promise<Float32Array>} 嵌入向量
 */
export async function generateEmbedding(text) {
  if (!text || typeof text !== "string") {
    return new Float32Array(VECTOR_DIM);
  }

  // 嘗試使用 transformer
  const extractor = await getEmbedder();
  if (extractor) {
    try {
      const output = await extractor(text, {
        pooling: "mean",
        normalize: true,
      });
      // output.data 是 Float32Array
      return new Float32Array(output.data);
    } catch (err) {
      console.warn("[vector-search] Transformer error, using fallback:", err.message);
    }
  }

  // Fallback 到 hash-based
  return generateHashEmbedding(text);
}

/**
 * 同步版本（僅 hash-based，用於向後兼容）
 * @deprecated 請使用 generateEmbedding() 異步版本
 */
export function generateLocalEmbedding(text) {
  return generateHashEmbedding(text);
}

/**
 * Hash-based 嵌入（fallback）
 * 基於 n-gram 的稀疏向量，速度快但語義理解有限
 */
function generateHashEmbedding(text) {
  if (!text || typeof text !== "string") {
    return new Float32Array(VECTOR_DIM);
  }

  const vector = new Float32Array(VECTOR_DIM);
  const normalized = text.toLowerCase().trim();

  // 基於 n-gram 的哈希嵌入
  for (let i = 0; i < normalized.length - 2; i++) {
    const trigram = normalized.substring(i, i + 3);
    const hash = hashString(trigram) % VECTOR_DIM;
    vector[hash] += 1;
  }

  // 加入單詞級別的特徵
  const words = normalized.split(/\s+/);
  for (const word of words) {
    const hash = hashString(word) % VECTOR_DIM;
    vector[hash] += 0.5;
  }

  // L2 正規化
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < VECTOR_DIM; i++) {
      vector[i] /= magnitude;
    }
  }

  return vector;
}

/**
 * 字符串哈希函數
 * @param {string} str
 * @returns {number}
 */
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

/**
 * 存儲消息向量（異步版本，使用 transformer）
 * @param {DatabaseSync} db
 * @param {number} messageId
 * @param {string} content
 * @returns {Promise<boolean>}
 */
export async function storeMessageVectorAsync(db, messageId, content) {
  if (!vecLoaded) {
    if (!initVectorSearch(db)) return false;
  }

  try {
    const embedding = await generateEmbedding(content);

    // vec0 虛擬表不支持 INSERT OR REPLACE，需要先刪除
    try {
      db.prepare("DELETE FROM message_vectors WHERE rowid = ?").run(BigInt(messageId));
    } catch {
      // 忽略刪除錯誤（可能不存在）
    }

    const insertVec = db.prepare("INSERT INTO message_vectors(rowid, embedding) VALUES (?, ?)");
    insertVec.run(BigInt(messageId), embedding);

    const insertMeta = db.prepare(`
      INSERT OR REPLACE INTO vector_metadata(source_table, source_id, text_preview)
      VALUES ('messages', ?, ?)
    `);
    insertMeta.run(messageId, content.substring(0, 200));

    return true;
  } catch (err) {
    console.error("[vector-search] Store error:", err.message);
    return false;
  }
}

/**
 * 存儲消息向量（同步版本，hash-based fallback）
 * @deprecated 請使用 storeMessageVectorAsync()
 */
export function storeMessageVector(db, messageId, content) {
  if (!vecLoaded) {
    if (!initVectorSearch(db)) return false;
  }

  try {
    const embedding = generateHashEmbedding(content);

    const insertVec = db.prepare(
      "INSERT OR REPLACE INTO message_vectors(rowid, embedding) VALUES (?, ?)",
    );
    insertVec.run(BigInt(messageId), embedding);

    const insertMeta = db.prepare(`
      INSERT OR REPLACE INTO vector_metadata(source_table, source_id, text_preview)
      VALUES ('messages', ?, ?)
    `);
    insertMeta.run(messageId, content.substring(0, 200));

    return true;
  } catch (err) {
    console.error("[vector-search] Store error:", err.message);
    return false;
  }
}

/**
 * 存儲知識庫向量
 * @param {DatabaseSync} db
 * @param {number} knowledgeId
 * @param {string} content
 * @returns {boolean}
 */
export function storeKnowledgeVector(db, knowledgeId, content) {
  if (!vecLoaded) {
    if (!initVectorSearch(db)) return false;
  }

  try {
    const embedding = generateLocalEmbedding(content);

    const insertVec = db.prepare(
      "INSERT OR REPLACE INTO knowledge_vectors(rowid, embedding) VALUES (?, ?)",
    );
    insertVec.run(BigInt(knowledgeId), embedding);

    const insertMeta = db.prepare(`
      INSERT OR REPLACE INTO vector_metadata(source_table, source_id, text_preview)
      VALUES ('knowledge_base', ?, ?)
    `);
    insertMeta.run(knowledgeId, content.substring(0, 200));

    return true;
  } catch (err) {
    console.error("[vector-search] Store knowledge error:", err.message);
    return false;
  }
}

/**
 * 語義搜索消息（異步版本，使用 transformer）
 * @param {DatabaseSync} db
 * @param {string} query - 搜索查詢
 * @param {Object} options
 * @param {number} options.limit - 返回數量（默認 10）
 * @param {number} options.minScore - 最小相似度（默認 0.3）
 * @returns {Promise<Array>} 搜索結果
 */
export async function semanticSearchAsync(db, query, options = {}) {
  const { limit = 10, minScore = 0.3 } = options;

  if (!vecLoaded) {
    if (!initVectorSearch(db)) return [];
  }

  try {
    const queryVector = await generateEmbedding(query);

    const results = db
      .prepare(
        `
      SELECT
        v.rowid as message_id,
        v.distance,
        m.timestamp,
        m.resolved_chat_name as chat,
        m.resolved_sender_name as sender,
        m.resolved_project as project,
        m.content
      FROM message_vectors v
      JOIN messages m ON v.rowid = m.id
      WHERE v.embedding MATCH ?
        AND k = ?
      ORDER BY v.distance ASC
    `,
      )
      .all(queryVector, limit * 2);

    return results
      .map((r) => ({
        ...r,
        similarity: 1 / (1 + r.distance),
      }))
      .filter((r) => r.similarity >= minScore)
      .slice(0, limit);
  } catch (err) {
    console.error("[vector-search] Search error:", err.message);
    return [];
  }
}

/**
 * 語義搜索消息（同步版本，hash-based）
 * @deprecated 請使用 semanticSearchAsync()
 */
export function semanticSearch(db, query, options = {}) {
  const { limit = 10, minScore = 0.3 } = options;

  if (!vecLoaded) {
    if (!initVectorSearch(db)) return [];
  }

  try {
    const queryVector = generateHashEmbedding(query);

    const results = db
      .prepare(
        `
      SELECT
        v.rowid as message_id,
        v.distance,
        m.timestamp,
        m.resolved_chat_name as chat,
        m.resolved_sender_name as sender,
        m.resolved_project as project,
        m.content
      FROM message_vectors v
      JOIN messages m ON v.rowid = m.id
      WHERE v.embedding MATCH ?
        AND k = ?
      ORDER BY v.distance ASC
    `,
      )
      .all(queryVector, limit * 2);

    return results
      .map((r) => ({
        ...r,
        similarity: 1 / (1 + r.distance),
      }))
      .filter((r) => r.similarity >= minScore)
      .slice(0, limit);
  } catch (err) {
    console.error("[vector-search] Search error:", err.message);
    return [];
  }
}

/**
 * 語義搜索知識庫
 * @param {DatabaseSync} db
 * @param {string} query
 * @param {Object} options
 * @returns {Array}
 */
export function semanticSearchKnowledge(db, query, options = {}) {
  const { limit = 10, category } = options;

  if (!vecLoaded) {
    if (!initVectorSearch(db)) return [];
  }

  try {
    const queryVector = generateLocalEmbedding(query);

    let sql = `
      SELECT
        v.rowid as knowledge_id,
        v.distance,
        k.category,
        k.topic,
        k.content,
        k.confidence,
        k.source
      FROM knowledge_vectors v
      JOIN knowledge_base k ON v.rowid = k.id
      WHERE v.embedding MATCH ?
        AND k = ?
    `;

    const params = [queryVector, limit];

    if (category) {
      sql = sql.replace("WHERE v.embedding", "WHERE k.category = ? AND v.embedding");
      params.unshift(category);
    }

    sql += " ORDER BY v.distance ASC";

    const results = db.prepare(sql).all(...params);

    return results.map((r) => ({
      ...r,
      similarity: 1 / (1 + r.distance),
    }));
  } catch (err) {
    console.error("[vector-search] Knowledge search error:", err.message);
    return [];
  }
}

/**
 * 批量生成向量（用於歷史數據遷移）- 異步版本
 * @param {DatabaseSync} db
 * @param {Object} options
 * @param {boolean} options.force - 強制重新生成所有向量
 * @returns {Promise<Object>} 遷移統計
 */
export async function migrateExistingMessagesAsync(db, options = {}) {
  const { maxMessages = 1000, force = false } = options;

  if (!vecLoaded) {
    if (!initVectorSearch(db)) {
      return { success: false, error: "sqlite-vec not loaded" };
    }
  }

  try {
    // 先確保 transformer 已載入
    await getEmbedder();

    let sql;
    if (force) {
      // 強制重新生成所有消息的向量
      sql = `
        SELECT m.id, m.content
        FROM messages m
        WHERE m.content IS NOT NULL
          AND LENGTH(m.content) > 10
        ORDER BY m.id DESC
        LIMIT ?
      `;
    } else {
      // 只處理沒有向量的消息
      sql = `
        SELECT m.id, m.content
        FROM messages m
        LEFT JOIN message_vectors v ON m.id = v.rowid
        WHERE v.rowid IS NULL
          AND m.content IS NOT NULL
          AND LENGTH(m.content) > 10
        ORDER BY m.id DESC
        LIMIT ?
      `;
    }

    const messages = db.prepare(sql).all(maxMessages);

    let migrated = 0;
    let failed = 0;

    console.log(
      `[vector-search] Migrating ${messages.length} messages${force ? " (force mode)" : ""}...`,
    );

    // 使用 transformer 嵌入
    for (const msg of messages) {
      if (await storeMessageVectorAsync(db, msg.id, msg.content)) {
        migrated++;
        if (migrated % 10 === 0) {
          console.log(`[vector-search] Migration progress: ${migrated}/${messages.length}`);
        }
      } else {
        failed++;
      }
    }

    const usingTransformer = embedder !== null;
    console.log(
      `[vector-search] Migration: ${migrated} success, ${failed} failed (transformer: ${usingTransformer})`,
    );

    return {
      success: true,
      total: messages.length,
      migrated,
      failed,
      usingTransformer,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 批量生成向量（同步版本，hash-based）
 * @deprecated 請使用 migrateExistingMessagesAsync()
 */
export function migrateExistingMessages(db, options = {}) {
  const { maxMessages = 1000 } = options;

  if (!vecLoaded) {
    if (!initVectorSearch(db)) {
      return { success: false, error: "sqlite-vec not loaded" };
    }
  }

  try {
    const messages = db
      .prepare(
        `
      SELECT m.id, m.content
      FROM messages m
      LEFT JOIN message_vectors v ON m.id = v.rowid
      WHERE v.rowid IS NULL
        AND m.content IS NOT NULL
        AND LENGTH(m.content) > 10
      ORDER BY m.id DESC
      LIMIT ?
    `,
      )
      .all(maxMessages);

    let migrated = 0;
    let failed = 0;

    for (const msg of messages) {
      if (storeMessageVector(db, msg.id, msg.content)) {
        migrated++;
      } else {
        failed++;
      }
    }

    console.log(`[vector-search] Migration: ${migrated} success, ${failed} failed`);

    return {
      success: true,
      total: messages.length,
      migrated,
      failed,
      usingTransformer: false,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 獲取向量搜索統計
 * @param {DatabaseSync} db
 * @returns {Object}
 */
export function getVectorStats(db) {
  if (!vecLoaded) {
    return { loaded: false };
  }

  try {
    const messageCount = db.prepare("SELECT COUNT(*) as count FROM message_vectors").get();
    const knowledgeCount = db.prepare("SELECT COUNT(*) as count FROM knowledge_vectors").get();
    const version = db.prepare("SELECT vec_version() as version").get();

    return {
      loaded: true,
      version: version.version,
      messageVectors: messageCount.count,
      knowledgeVectors: knowledgeCount.count,
      dimension: VECTOR_DIM,
      embedder: embedder ? "transformer (all-MiniLM-L6-v2)" : "hash-based (fallback)",
      transformerReady: embedder !== null,
      transformerFailed: embedderFailed,
    };
  } catch (err) {
    return { loaded: true, error: err.message };
  }
}

/**
 * 預熱 transformer（提前載入模型）
 * @returns {Promise<boolean>}
 */
export async function warmupTransformer() {
  const extractor = await getEmbedder();
  return extractor !== null;
}

export { VECTOR_DIM };
