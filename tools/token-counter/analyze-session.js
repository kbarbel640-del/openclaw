#!/usr/bin/env node

/**
 * Session Token Analyzer for OpenClaw
 * Analyzes past sessions to show token usage per instruction
 * 
 * Usage:
 *   node analyze-session.js <session-file.jsonl>
 *   node analyze-session.js --last 5
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const TOKENIZER_PATH = path.join(__dirname, 'tokenize.js');
const SESSIONS_DIR = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'sessions');

function countTokens(text, model = 'default') {
  // Simple deterministic token counter
  if (!text || typeof text !== 'string') return 0;
  
  let tokens = 0;
  
  // Words (~4 chars per token)
  const words = text.match(/[a-zA-Z]+/g) || [];
  words.forEach(w => tokens += Math.ceil(w.length / 4));
  
  // Numbers
  tokens += (text.match(/\d+/g) || []).length;
  
  // CJK
  tokens += (text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
  
  // Whitespace/newlines
  tokens += (text.match(/\s+/g) || []).length;
  
  // Punctuation
  tokens += (text.match(/[.,!?;:'"()\[\]{}<>=+\-*/\\|&^%$#@!~`]/g) || []).length;
  
  return Math.ceil(tokens);
}

function analyzeSession(sessionPath) {
  if (!fs.existsSync(sessionPath)) {
    console.error(`Session file not found: ${sessionPath}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(sessionPath, 'utf-8');
  const lines = content.trim().split('\n');
  
  const results = [];
  let totalUserTokens = 0;
  let totalAssistantTokens = 0;
  let totalToolTokens = 0;
  
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      
      if (entry.role === 'user') {
        const text = entry.content || '';
        const tokens = countTokens(text);
        totalUserTokens += tokens;
        
        results.push({
          type: 'user',
          tokens,
          preview: text.substring(0, 80) + (text.length > 80 ? '...' : ''),
        });
      } else if (entry.role === 'assistant') {
        let text = '';
        if (typeof entry.content === 'string') {
          text = entry.content;
        } else if (Array.isArray(entry.content)) {
          text = entry.content.map(c => c.text || '').join('');
        }
        const tokens = countTokens(text);
        totalAssistantTokens += tokens;
        
        results.push({
          type: 'assistant',
          tokens,
          preview: text.substring(0, 80) + (text.length > 80 ? '...' : ''),
        });
      } else if (entry.tool_result) {
        const text = JSON.stringify(entry.tool_result);
        const tokens = countTokens(text);
        totalToolTokens += tokens;
        
        results.push({
          type: 'tool',
          tokens,
          preview: `[tool result: ${tokens} tokens]`,
        });
      }
    } catch {
      // Skip malformed lines
    }
  }
  
  return {
    results,
    totalUserTokens,
    totalAssistantTokens,
    totalToolTokens,
    grandTotal: totalUserTokens + totalAssistantTokens + totalToolTokens,
  };
}

function findRecentSessions(count = 5) {
  if (!fs.existsSync(SESSIONS_DIR)) {
    return [];
  }
  
  const files = fs.readdirSync(SESSIONS_DIR)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => ({
      path: path.join(SESSIONS_DIR, f),
      mtime: fs.statSync(path.join(SESSIONS_DIR, f)).mtime,
    }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, count);
  
  return files;
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Session Token Analyzer - Analyze token usage in OpenClaw sessions

Usage:
  node analyze-session.js <session-file.jsonl>
  node analyze-session.js --last <n>
  node analyze-session.js --current

Options:
  --last <n>     Analyze last n sessions (default: 5)
  --current      Analyze current session
  --json         Output as JSON
  -h, --help     Show this help
    `);
    process.exit(0);
  }
  
  const asJson = args.includes('--json');
  
  if (args.includes('--last')) {
    const idx = args.indexOf('--last');
    const count = parseInt(args[idx + 1]) || 5;
    const sessions = findRecentSessions(count);
    
    if (sessions.length === 0) {
      console.log('No sessions found.');
      return;
    }
    
    console.log(`\n📊 Last ${sessions.length} Sessions:\n`);
    
    for (const session of sessions) {
      const analysis = analyzeSession(session.path);
      console.log(`${path.basename(session.path)}:`);
      console.log(`  User: ${analysis.totalUserTokens} | Assistant: ${analysis.totalAssistantTokens} | Tools: ${analysis.totalToolTokens}`);
      console.log(`  Total: ${analysis.grandTotal} tokens\n`);
    }
    return;
  }
  
  const sessionPath = args.find(a => !a.startsWith('-'));
  
  if (!sessionPath) {
    console.log('Usage: node analyze-session.js <session-file.jsonl>');
    console.log('       node analyze-session.js --last 5');
    process.exit(1);
  }
  
  const analysis = analyzeSession(sessionPath);
  
  if (asJson) {
    console.log(JSON.stringify(analysis, null, 2));
  } else {
    console.log(`\n📊 Token Analysis: ${path.basename(sessionPath)}\n`);
    console.log('Per-message breakdown:\n');
    
    for (const r of analysis.results) {
      const icon = r.type === 'user' ? '👤' : r.type === 'assistant' ? '🤖' : '🔧';
      console.log(`${icon} [${r.tokens} tokens] ${r.preview}`);
    }
    
    console.log('\n📈 Summary:');
    console.log(`  User tokens:      ${analysis.totalUserTokens}`);
    console.log(`  Assistant tokens: ${analysis.totalAssistantTokens}`);
    console.log(`  Tool tokens:      ${analysis.totalToolTokens}`);
    console.log(`  ────────────────────────────`);
    console.log(`  Total:            ${analysis.grandTotal} tokens`);
  }
}

main();
