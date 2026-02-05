// Video Processor Hook - 自動處理超過 5MB 的影片
// 流程：檢測大影片 → userbot 下載 → ffmpeg 提取關鍵幀 → 注入 context

import http from 'http';
import https from 'https';
import path from 'path';

const EXEC_BRIDGE_URL = 'http://host.docker.internal:18793/exec';
const USERBOT_URL = 'http://host.docker.internal:18790';
const MAX_SIZE_MB = 5;
const FRAMES_DIR = '/tmp/video-frames';
const OUTPUT_DIR = '/app/workspace/output';

// HTTP request helper
function httpRequest(url, options = {}, data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const lib = urlObj.protocol === 'https:' ? https : http;

    const req = lib.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

// Execute command via exec-bridge
async function execBridge(command) {
  try {
    const result = await httpRequest(EXEC_BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ command, timeout: 120 }));
    return result;
  } catch (err) {
    console.error('[video-processor] exec-bridge error:', err.message);
    return { ok: false, error: err.message };
  }
}

// Download video via userbot
async function downloadVideo(chatId, messageId) {
  try {
    const result = await httpRequest(`${USERBOT_URL}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ chat: chatId, message_id: messageId }));
    return result;
  } catch (err) {
    console.error('[video-processor] download error:', err.message);
    return { success: false, error: err.message };
  }
}

// Extract frames from video
async function extractFrames(videoPath, outputPrefix) {
  const cmd = `mkdir -p ${FRAMES_DIR} && ffmpeg -y -i "${videoPath}" -vf fps=0.5 "${FRAMES_DIR}/${outputPrefix}_%02d.jpg" 2>&1 | tail -3`;
  return execBridge(cmd);
}

// Get video metadata
async function getVideoMetadata(videoPath) {
  const cmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`;
  const result = await execBridge(cmd);
  if (result.ok && result.stdout) {
    try {
      return JSON.parse(result.stdout);
    } catch {
      return null;
    }
  }
  return null;
}

async function handler(event, context) {
  const { channel, chatId, messageId, media, from } = event.payload || {};

  // Only process Telegram messages with video
  if (channel !== 'telegram') return;
  if (!media || media.type !== 'video') return;

  // Check file size (if available)
  const sizeMB = (media.fileSize || 0) / (1024 * 1024);
  if (sizeMB <= MAX_SIZE_MB && sizeMB > 0) return; // Small enough, let Moltbot handle it

  console.log(`[video-processor] Large video detected: ${sizeMB.toFixed(2)}MB from ${from} in ${chatId}`);

  try {
    // 1. Download via userbot
    console.log('[video-processor] Downloading...');
    const downloadResult = await downloadVideo(chatId, messageId);

    if (!downloadResult.success || !downloadResult.path) {
      console.error('[video-processor] Download failed:', downloadResult);
      return;
    }

    const videoPath = downloadResult.path;
    const videoName = path.basename(videoPath, path.extname(videoPath));

    // 2. Get metadata
    console.log('[video-processor] Getting metadata...');
    const metadata = await getVideoMetadata(videoPath);
    const duration = metadata?.format?.duration || 'unknown';
    const resolution = metadata?.streams?.[0]
      ? `${metadata.streams[0].width}x${metadata.streams[0].height}`
      : 'unknown';

    // 3. Extract frames
    console.log('[video-processor] Extracting frames...');
    const extractResult = await extractFrames(videoPath, videoName);

    if (!extractResult.ok) {
      console.error('[video-processor] Frame extraction failed:', extractResult);
      return;
    }

    // 4. Copy frames to output dir
    const copyCmd = `cp ${FRAMES_DIR}/${videoName}_*.jpg ${OUTPUT_DIR}/ 2>/dev/null; ls ${OUTPUT_DIR}/${videoName}_*.jpg 2>/dev/null | wc -l`;
    const copyResult = await execBridge(copyCmd);
    const frameCount = parseInt(copyResult.stdout?.trim()) || 0;

    console.log(`[video-processor] Extracted ${frameCount} frames`);

    // 5. Inject processed info into event context
    event.payload.videoProcessed = {
      originalPath: videoPath,
      duration,
      resolution,
      frameCount,
      framesDir: `${OUTPUT_DIR}/${videoName}_*.jpg`,
      metadata: {
        sizeMB: sizeMB.toFixed(2),
        processedAt: new Date().toISOString()
      }
    };

    // 6. Replace media text hint
    event.payload.mediaHint = `[影片已處理: ${duration}秒, ${resolution}, ${frameCount}張關鍵幀已提取到 output/]`;

    console.log('[video-processor] Done!');

  } catch (err) {
    console.error('[video-processor] Error:', err);
  }
}

export default handler;
