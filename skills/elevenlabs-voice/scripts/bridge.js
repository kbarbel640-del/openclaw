#!/usr/bin/env node
/**
 * ElevenLabs Voice Bridge
 * 
 * Routes voice requests from ElevenLabs Conversational AI through Clawdbot.
 * Voice callers get full access to your agent's capabilities.
 * 
 * Usage: node bridge.js [--port 3001]
 * 
 * Environment:
 *   CLAWDBOT_URL - Clawdbot gateway URL (default: http://127.0.0.1:18789)
 *   ELEVENLABS_WEBHOOK_SECRET - Optional HMAC verification for post-call webhooks
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name, defaultVal) => {
  const idx = args.findIndex(a => a === `--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
};

const PORT = parseInt(getArg('port', '3001'));
const HOME = os.homedir();
const CLAWDBOT_URL = process.env.CLAWDBOT_URL || 'http://127.0.0.1:18789';
const ELEVENLABS_WEBHOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET;

// Load clawdbot config for hook token
let HOOK_TOKEN;
try {
  const config = JSON.parse(fs.readFileSync(path.join(HOME, '.clawdbot/clawdbot.json'), 'utf8'));
  HOOK_TOKEN = config?.hooks?.token;
} catch (e) {
  console.error('⚠️  Could not load ~/.clawdbot/clawdbot.json - webhook auth will fail');
}

// Session tracking for conversation continuity
const sessions = new Map();

// Cleanup old sessions (>1 hour)
setInterval(() => {
  const cutoff = Date.now() - 3600000;
  for (const [id, session] of sessions) {
    if (session.lastActivity < cutoff) sessions.delete(id);
  }
}, 300000);

// Quick responses for common patterns (reduces latency)
function getInstantResponse(question) {
  const q = question.toLowerCase().trim();
  
  if (q === '' || q === 'hello' || q === 'hi' || q === 'hey' || q.match(/^(call |conversation )?(started|beginning)/)) {
    return "Hey! What's up?";
  }
  
  if (q.match(/^what('s| is) the time\??$|^what time is it\??$/)) {
    const now = new Date();
    const h = now.getHours() % 12 || 12;
    const m = now.getMinutes().toString().padStart(2, '0');
    const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
    return `It's ${h}:${m} ${ampm}.`;
  }
  
  return null;
}

// Send request to Clawdbot and wait for response
async function askAgentAndWait(question, conversationId) {
  const sessionKey = `voice:${conversationId}`;
  
  let session = sessions.get(conversationId);
  if (!session) {
    session = { history: [], lastActivity: Date.now() };
    sessions.set(conversationId, session);
  }
  session.lastActivity = Date.now();
  session.history.push({ role: 'user', text: question, time: Date.now() });
  
  // Build context from recent conversation
  const recentHistory = session.history.slice(-6).map(h => 
    `${h.role === 'user' ? 'User' : 'Agent'}: ${h.text}`
  ).join('\n');

  const message = `[VOICE CALL - Keep response SHORT, 1-3 sentences, conversational, no markdown/URLs]

${recentHistory ? `Recent conversation:\n${recentHistory}\n\n` : ''}User just said: "${question}"

Respond naturally as if on a phone call. You have full access to all your capabilities.`;

  return new Promise((resolve) => {
    const payload = JSON.stringify({
      message,
      name: 'Voice',
      sessionKey,
      deliver: false,
      timeoutSeconds: 25,
    });

    const startTime = Date.now();
    let resolved = false;

    const url = new URL(CLAWDBOT_URL);
    const req = http.request({
      hostname: url.hostname,
      port: url.port || 80,
      path: '/hooks/agent',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HOOK_TOKEN}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        if (res.statusCode === 200 || res.statusCode === 202) {
          const response = await pollForResponse(sessionKey, startTime, 18000);
          if (!resolved) {
            resolved = true;
            session.history.push({ role: 'assistant', text: response, time: Date.now() });
            resolve(response);
          }
        } else {
          if (!resolved) {
            resolved = true;
            console.error(`Hook returned ${res.statusCode}: ${data}`);
            resolve("Something went wrong, try again.");
          }
        }
      });
    });

    req.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        console.error('Request error:', err.message);
        resolve("Having trouble connecting right now.");
      }
    });
    
    req.setTimeout(20000, () => {
      if (!resolved) {
        resolved = true;
        resolve("Still thinking about that one...");
      }
    });
    
    req.write(payload);
    req.end();
  });
}

// Poll session files for agent response
async function pollForResponse(sessionKey, startTime, maxWait) {
  const sessionsDir = path.join(HOME, '.clawdbot/agents/main/sessions');
  const pollStart = Date.now();
  
  while (Date.now() - pollStart < maxWait) {
    try {
      const files = fs.readdirSync(sessionsDir)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => ({ name: f, mtime: fs.statSync(path.join(sessionsDir, f)).mtime }))
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 5);
      
      for (const file of files) {
        const content = fs.readFileSync(path.join(sessionsDir, file.name), 'utf8');
        const lines = content.trim().split('\n');
        
        for (let i = lines.length - 1; i >= Math.max(0, lines.length - 20); i--) {
          try {
            const entry = JSON.parse(lines[i]);
            
            if (entry.message?.role === 'assistant' && entry.timestamp) {
              const entryTime = new Date(entry.timestamp).getTime();
              
              if (entryTime > startTime) {
                let text = '';
                if (typeof entry.message.content === 'string') {
                  text = entry.message.content;
                } else if (Array.isArray(entry.message.content)) {
                  text = entry.message.content
                    .filter(c => c.type === 'text')
                    .map(c => c.text)
                    .join('');
                }
                
                if (text && 
                    !text.includes('HEARTBEAT') && 
                    !text.includes('NO_REPLY') &&
                    text.length > 5) {
                  return cleanForVoice(text);
                }
              }
            }
          } catch (e) {}
        }
      }
    } catch (e) {
      console.error('Poll error:', e.message);
    }
    
    await sleep(300);
  }
  
  return "I'm still working on that. Give me a moment.";
}

function cleanForVoice(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/https?:\/\/[^\s]+/g, 'a link')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 500);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(e); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Main tool endpoint for ElevenLabs
  if (req.method === 'POST' && req.url === '/tool/ask-agent') {
    const start = Date.now();
    try {
      const body = await parseBody(req);
      const question = body.question || '';
      const conversationId = body.conversation_id || 'default';
      
      console.log(`📞 [${conversationId.slice(0, 8)}] "${question.substring(0, 60)}${question.length > 60 ? '...' : ''}"`);
      
      if (!question.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No question provided' }));
        return;
      }

      const instant = getInstantResponse(question);
      if (instant) {
        console.log(`⚡ Instant: "${instant}"`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ response: instant }));
        return;
      }

      const response = await askAgentAndWait(question, conversationId);
      const elapsed = Date.now() - start;
      
      console.log(`💬 [${elapsed}ms] "${response.substring(0, 60)}${response.length > 60 ? '...' : ''}"`);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ response }));
      
    } catch (err) {
      console.error(`❌`, err.message);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ response: "Something went wrong, try again." }));
    }
    return;
  }

  // Health check
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      sessions: sessions.size,
      clawdbot: CLAWDBOT_URL
    }));
    return;
  }

  // Post-call webhook from ElevenLabs (optional)
  if (req.method === 'POST' && req.url === '/webhook/post-call') {
    try {
      const body = await parseBody(req);
      console.log('📊 Post-call webhook received');
      
      // Verify HMAC if configured
      if (ELEVENLABS_WEBHOOK_SECRET) {
        const signature = req.headers['x-elevenlabs-signature'] || req.headers['x-signature'];
        if (signature) {
          const crypto = require('crypto');
          const rawBody = JSON.stringify(body);
          const expectedSig = crypto.createHmac('sha256', ELEVENLABS_WEBHOOK_SECRET).update(rawBody).digest('hex');
          if (signature !== expectedSig && signature !== `sha256=${expectedSig}`) {
            console.log('⚠️  HMAC signature mismatch');
          }
        }
      }
      
      // Log call details
      if (body.conversation_id) {
        console.log(`   Conversation: ${body.conversation_id}`);
        console.log(`   Duration: ${body.call_duration_secs || 'unknown'}s`);
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    } catch (err) {
      console.error('Webhook error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`🎙️  ElevenLabs Voice Bridge`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Clawdbot: ${CLAWDBOT_URL}`);
  console.log(`   Hook token: ${HOOK_TOKEN ? '✓' : '✗ (check ~/.clawdbot/clawdbot.json)'}`);
  console.log(`   Ready for calls`);
});
