#!/usr/bin/env node

/**
 * API Token Reporter - Extracts ACTUAL token usage from OpenClaw session files
 * Uses the usage data reported by the LLM provider API
 * 
 * Usage:
 *   node api-usage.js                    # Current session summary
 *   node api-usage.js --last             # Last assistant message tokens
 *   node api-usage.js --turn             # Current turn (last user + assistant)
 *   node api-usage.js --session <file>   # Specific session file
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const SESSIONS_DIR = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'sessions');

function getCurrentSessionFile() {
  // Find most recently modified session file
  try {
    const files = fs.readdirSync(SESSIONS_DIR)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => ({
        path: path.join(SESSIONS_DIR, f),
        mtime: fs.statSync(path.join(SESSIONS_DIR, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);
    
    return files[0]?.path;
  } catch {
    return null;
  }
}

function parseSessionFile(sessionPath) {
  const content = fs.readFileSync(sessionPath, 'utf-8');
  const lines = content.trim().split('\n');
  
  const messages = [];
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;
  let totalCost = 0;
  let turns = 0;
  
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      
      if (entry.type === 'message' && entry.message?.role === 'assistant') {
        const usage = entry.message?.usage || {};
        const input = usage.input || 0;
        const output = usage.output || 0;
        const cacheRead = usage.cacheRead || 0;
        const cacheWrite = usage.cacheWrite || 0;
        const cost = usage.cost?.total || 0;
        
        if (input > 0 || output > 0) {
          messages.push({
            id: entry.id,
            timestamp: entry.timestamp,
            input,
            output,
            cacheRead,
            cacheWrite,
            total: usage.totalTokens || input + output,
            cost,
            stopReason: entry.message?.stopReason
          });
          
          totalInput += input;
          totalOutput += output;
          totalCacheRead += cacheRead;
          totalCacheWrite += cacheWrite;
          totalCost += cost;
          turns++;
        }
      }
    } catch {
      // Skip malformed lines
    }
  }
  
  return {
    messages,
    totals: {
      input: totalInput,
      output: totalOutput,
      cacheRead: totalCacheRead,
      cacheWrite: totalCacheWrite,
      cost: totalCost,
      turns
    }
  };
}

function formatCompactReport(lastMsg, totals) {
  // Compact format for appending to messages
  if (lastMsg) {
    const totalIn = lastMsg.input + (lastMsg.cacheRead || 0);
    const cacheStr = lastMsg.cacheRead ? ` (+${lastMsg.cacheRead} cached)` : '';
    return `📊 Tokens: ${lastMsg.input} in${cacheStr} / ${lastMsg.output} out | Total: ${totalIn}`;
  }
  return `📊 Session: ${totals.input} in / ${totals.output} out (${totals.turns} turns)`;
}

function formatFullReport(session, sessionPath) {
  const lines = [
    `📊 **API Token Report**`,
    `Session: ${path.basename(sessionPath)}`,
    ``,
    `**Totals:**`,
    `├ Input:      ${session.totals.input.toLocaleString()} tokens`,
    `├ Output:     ${session.totals.output.toLocaleString()} tokens`,
    `├ Cache Read: ${session.totals.cacheRead.toLocaleString()} tokens`,
    `├ Cache Write:${session.totals.cacheWrite.toLocaleString()} tokens`,
    `├ Turns:      ${session.totals.turns}`,
    `└ Cost:       $${session.totals.cost.toFixed(6)}`,
    ``,
    `**Last 5 turns:**`
  ];
  
  const recent = session.messages.slice(-5);
  for (const msg of recent) {
    const time = new Date(msg.timestamp).toLocaleTimeString();
    lines.push(`  [${time}] ${msg.input} in / ${msg.output} out (${msg.stopReason})`);
  }
  
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  
  let sessionPath = null;
  let mode = 'summary';
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--last' || arg === '-l') {
      mode = 'last';
    } else if (arg === '--turn' || arg === '-t') {
      mode = 'turn';
    } else if (arg === '--session' || arg === '-s') {
      sessionPath = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
API Token Reporter - Extract real token usage from LLM API responses

Usage:
  node api-usage.js                  # Session summary
  node api-usage.js --last           # Last message only (compact)
  node api-usage.js --turn           # Current turn report
  node api-usage.js --session <file> # Specific session

Output modes:
  --last   Compact format for appending to messages
  --turn   Last user message + assistant response
  (default) Full session summary
      `);
      process.exit(0);
    }
  }
  
  if (!sessionPath) {
    sessionPath = getCurrentSessionFile();
  }
  
  if (!sessionPath || !fs.existsSync(sessionPath)) {
    console.log('📊 No session file found');
    process.exit(1);
  }
  
  const session = parseSessionFile(sessionPath);
  const lastMsg = session.messages[session.messages.length - 1];
  
  if (mode === 'last') {
    console.log(formatCompactReport(lastMsg, session.totals));
  } else if (mode === 'turn') {
    // For turn mode, show last message stats
    console.log(`📊 **This turn:** ${lastMsg.input} in / ${lastMsg.output} out`);
    console.log(`📊 **Session total:** ${session.totals.input + session.totals.output} tokens (${session.totals.input} in / ${session.totals.output} out | ${session.totals.turns} turns)`);
  } else {
    console.log(formatFullReport(session, sessionPath));
  }
}

main();
