#!/usr/bin/env node

/**
 * Token Tracker - Maintains cumulative session statistics
 * Call at the start and end of each turn
 * 
 * Usage:
 *   node track.js --init                    # Start new tracking session
 *   node track.js --add-input "text"        # Add user input
 *   node track.js --add-output "text"       # Add assistant output  
 *   node track.js --add-tool                # Increment tool counter
 *   node track.js --report                  # Get current report
 *   node track.js --reset                   # Reset counters
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'track-state.json');

function countTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  
  let tokens = 0;
  const words = text.match(/[a-zA-Z]+/g) || [];
  words.forEach(w => tokens += Math.ceil(w.length / 4));
  tokens += (text.match(/\d+/g) || []).length;
  tokens += (text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
  tokens += (text.match(/\s+/g) || []).length;
  tokens += (text.match(/[.,!?;:'"()\[\]{}<>=+\-*/\\|&^%$#@!~`]/g) || []).length;
  
  return Math.ceil(tokens);
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return {
      startTime: new Date().toISOString(),
      inputTokens: 0,
      outputTokens: 0,
      toolCalls: 0,
      turns: 0,
      lastInput: '',
      lastOutput: ''
    };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function main() {
  const args = process.argv.slice(2);
  const state = loadState();
  
  let output = '';
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--init') {
      state.startTime = new Date().toISOString();
      state.inputTokens = 0;
      state.outputTokens = 0;
      state.toolCalls = 0;
      state.turns = 0;
      state.lastInput = '';
      state.lastOutput = '';
      saveState(state);
      output = '📊 Tracking initialized';
      
    } else if (arg === '--reset') {
      state.inputTokens = 0;
      state.outputTokens = 0;
      state.toolCalls = 0;
      state.turns = 0;
      saveState(state);
      output = '📊 Counters reset';
      
    } else if (arg === '--add-input') {
      const text = args[++i] || '';
      const tokens = countTokens(text);
      state.inputTokens += tokens;
      state.lastInput = text;
      state.turns++;
      saveState(state);
      output = `📊 +${tokens} input tokens`;
      
    } else if (arg === '--add-output') {
      const text = args[++i] || '';
      const tokens = countTokens(text);
      state.outputTokens += tokens;
      state.lastOutput = text;
      saveState(state);
      output = `📊 +${tokens} output tokens`;
      
    } else if (arg === '--add-tool') {
      const count = parseInt(args[++i]) || 1;
      state.toolCalls += count;
      saveState(state);
      output = `📊 +${count} tool calls`;
      
    } else if (arg === '--report') {
      const total = state.inputTokens + state.outputTokens;
      output = [
        `📊 **Token Report**`,
        `├ Session: ${state.turns} turns`,
        `├ Input:  ${state.inputTokens} tokens`,
        `├ Output: ${state.outputTokens} tokens`,
        `├ Tools:  ${state.toolCalls} calls`,
        `└ Total:  ${total} tokens`
      ].join('\n');
    }
  }
  
  if (output) console.log(output);
  else {
    console.log(JSON.stringify(state, null, 2));
  }
}

main();
