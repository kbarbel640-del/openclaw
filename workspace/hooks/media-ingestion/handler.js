/**
 * Media Ingestion Hook - 統一媒體處理管道
 *
 * 事件：message:received
 * 功能：統一處理來自各 channel 的媒體，提供 OCR/描述
 */

const MEDIA_ROOT = process.env.MEDIA_ROOT || "/app/media";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Channel 到媒體目錄的映射
const CHANNEL_DIRS = {
  telegram: `${MEDIA_ROOT}/telegram`,
  line: `${MEDIA_ROOT}/line`,
  discord: `${MEDIA_ROOT}/discord`,
  web: `${MEDIA_ROOT}/web`,
};

// 支援的媒體類型
const MEDIA_TYPES = {
  image: ["jpg", "jpeg", "png", "gif", "webp"],
  audio: ["mp3", "ogg", "m4a", "wav", "opus"],
  video: ["mp4", "mov", "avi", "webm"],
  document: ["pdf", "doc", "docx", "txt", "md"],
};

/**
 * 從檔案路徑判斷媒體類型
 */
function getMediaType(path) {
  if (!path) return null;
  const ext = path.split(".").pop()?.toLowerCase();
  for (const [type, extensions] of Object.entries(MEDIA_TYPES)) {
    if (extensions.includes(ext)) return type;
  }
  return null;
}

/**
 * 從 event 提取 channel 名稱
 */
function getChannel(event) {
  const sessionKey = event.context?.sessionKey || "";
  if (sessionKey.includes(":telegram:")) return "telegram";
  if (sessionKey.includes(":line:")) return "line";
  if (sessionKey.includes(":discord:")) return "discord";
  if (event.context?.channel) return event.context.channel;
  return "unknown";
}

/**
 * 使用 Claude Haiku 描述圖片
 */
async function describeImage(imagePath) {
  if (!ANTHROPIC_API_KEY) {
    console.log("[media-ingestion] No ANTHROPIC_API_KEY, skipping image description");
    return null;
  }

  try {
    // 讀取圖片為 base64
    const fs = await import("node:fs/promises");
    const imageData = await fs.readFile(imagePath);
    const base64 = imageData.toString("base64");
    const ext = imagePath.split(".").pop()?.toLowerCase() || "jpeg";
    const mediaType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64,
                },
              },
              {
                type: "text",
                text: `請用繁體中文簡潔描述這張圖片的內容（1-2句話）。
如果圖片包含文字，請提取出來（OCR）。

回覆格式：
描述: <圖片描述>
文字: <提取的文字，如果沒有則寫「無」>`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`[media-ingestion] Haiku API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const text = data.content[0]?.text || "";

    // 解析回覆
    const descMatch = text.match(/描述[:：]\s*(.+?)(?:\n|$)/);
    const ocrMatch = text.match(/文字[:：]\s*(.+?)(?:\n|$)/s);

    return {
      description: descMatch?.[1]?.trim() || text.split("\n")[0],
      ocrText: ocrMatch?.[1]?.trim() === "無" ? null : ocrMatch?.[1]?.trim(),
      raw: text,
    };
  } catch (err) {
    console.error(`[media-ingestion] Image description failed: ${err.message}`);
    return null;
  }
}

/**
 * 處理媒體訊息
 */
async function processMedia(event) {
  const channel = getChannel(event);
  const payload = event.payload || {};

  // 檢查是否有媒體附件
  const mediaPath =
    payload.imagePath ||
    payload.audioPath ||
    payload.videoPath ||
    payload.documentPath ||
    payload.filePath;

  if (!mediaPath) return null;

  const mediaType = getMediaType(mediaPath);
  if (!mediaType) return null;

  console.log(`[media-ingestion] Processing ${mediaType} from ${channel}: ${mediaPath}`);

  const result = {
    type: mediaType,
    channel,
    originalPath: mediaPath,
    processed: {},
    hint: "",
  };

  // 根據類型處理
  switch (mediaType) {
    case "image": {
      const description = await describeImage(mediaPath);
      if (description) {
        result.processed.description = description.description;
        result.processed.ocrText = description.ocrText;
        result.hint = `[圖片: ${description.description}${description.ocrText ? `，含文字: "${description.ocrText.substring(0, 50)}..."` : ""}]`;
      } else {
        result.hint = `[圖片: ${mediaPath.split("/").pop()}]`;
      }
      break;
    }

    case "audio":
      // TODO: 接入 Whisper API
      result.hint = `[語音: 尚未轉文字]`;
      break;

    case "video":
      // 委派給 video-processor
      result.hint = `[視頻: 將由 video-processor 處理]`;
      break;

    case "document":
      result.hint = `[文件: ${mediaPath.split("/").pop()}]`;
      break;
  }

  return result;
}

/**
 * Hook Handler
 */
async function handler(event) {
  // 只處理 message:received 事件
  if (event.type !== "message" || event.action !== "received") {
    return;
  }

  try {
    const mediaResult = await processMedia(event);

    if (mediaResult) {
      console.log(`[media-ingestion] Processed: ${mediaResult.hint}`);

      // 注入到 event payload
      return {
        inject: {
          media: mediaResult,
          mediaHint: mediaResult.hint,
        },
      };
    }
  } catch (err) {
    console.error(`[media-ingestion] Error: ${err.message}`);
  }

  return;
}

export default handler;
