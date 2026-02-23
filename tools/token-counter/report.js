#!/usr/bin/env node

/**
 * Token Reporter - Clear metrics with context window utilization
 * 
 * Usage:
 *   node report.js --tools 5    # Report with 5 tool calls this turn
 *   node report.js --reset      # Reset tool counter
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const API_USAGE = path.join(__dirname, 'api-usage.js');
const STATE_FILE = path.join(__dirname, 'tool-count.json');
const CONFIG_PATH = path.join(os.homedir(), '.openclaw', 'openclaw.json');

// Model context window sizes (in tokens)
const MODEL_CONTEXT_WINDOWS = {
  // Z.AI
  'zai/glm-5': 204800,
  'zai/glm-4.7': 204800,
  'zai/glm-4.7-flash': 204800,
  'zai/glm-4.7-flashx': 204800,
  
  // MiniMax
  'minimax/MiniMax-M2.5': 200000,
  
  // Anthropic
  'anthropic/claude-sonnet-4-5': 200000,
  'anthropic/claude-opus-4-5': 200000,
  'anthropic/claude-3-5-sonnet': 200000,
  'anthropic/claude-3-opus': 200000,
  
  // Google
  'google/gemini-3-pro-preview': 1000000,
  'google/gemini-3-flash-preview': 1000000,
  'google/gemini-2.5-pro': 1000000,
  'google/gemini-2.5-flash': 1000000,
  
  // OpenAI
  'openai/gpt-4o': 128000,
  'openai/gpt-4-turbo': 128000,
  'openai/gpt-4': 8192,
  'openai/gpt-3.5-turbo': 16385,
  
  // OpenRouter free tier (common models)
  'openrouter/stepfun/step-3.5-flash:free': 65536,
  'openrouter/arcee-ai/trinity-large-preview:free': 32768,
  
  // Default fallback
  'default': 128000
};

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return { sessionTools: 0, turnTools: 0 };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function format(n) {
  return parseInt(n || 0).toLocaleString();
}

function formatPercent(value, max) {
  if (!max || max === 0) return '?%';
  const percent = (value / max) * 100;
  return `${percent.toFixed(1)}%`;
}

function getUtilizationEmoji(percent) {
  if (percent >= 90) return '🔴';  // Critical
  if (percent >= 75) return '🟠';  // Warning
  if (percent >= 50) return '🟡';  // Caution
  return '🟢';  // Good
}

function getUtilizationBar(percent, width = 10) {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function getCurrentModel() {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    const primary = config?.agents?.defaults?.model?.primary || '';
    return primary;
  } catch {
    return '';
  }
}

function getContextWindowSize(model) {
  // Direct match
  if (MODEL_CONTEXT_WINDOWS[model]) {
    return MODEL_CONTEXT_WINDOWS[model];
  }
  
  // Partial match (provider/model pattern)
  const modelLower = model.toLowerCase();
  for (const [key, size] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (modelLower.includes(key.toLowerCase()) || key.toLowerCase().includes(modelLower)) {
      return size;
    }
  }
  
  // Provider-based fallback
  if (modelLower.includes('gemini')) return 1000000;
  if (modelLower.includes('claude')) return 200000;
  if (modelLower.includes('gpt-4')) return 128000;
  if (modelLower.includes('glm')) return 204800;
  if (modelLower.includes('minimax')) return 200000;
  
  return MODEL_CONTEXT_WINDOWS['default'];
}

function main() {
  const args = process.argv.slice(2);
  const state = loadState();
  
  let toolCount = 0;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tools' || args[i] === '-t') {
      toolCount = parseInt(args[++i]) || 0;
    } else if (args[i] === '--reset') {
      state.sessionTools = 0;
      state.turnTools = 0;
      saveState(state);
      console.log('📊 Tool counter reset');
      return;
    }
  }
  
  // Update state
  state.turnTools = toolCount;
  state.sessionTools += toolCount;
  saveState(state);
  
  // Get last turn data
  let turnInput = 0, turnCache = 0, turnOutput = 0;
  try {
    const lastReport = execSync(`node "${API_USAGE}" --last`, { encoding: 'utf-8' }).trim();
    const match = lastReport.match(/Tokens: (\d+) in(?: \(\+(\d+) cached\))? \/ (\d+) out/);
    if (match) {
      turnInput = parseInt(match[1]) || 0;
      turnCache = parseInt(match[2]) || 0;
      turnOutput = parseInt(match[3]) || 0;
    }
  } catch (e) {}
  
  // Get session totals
  let sessionInput = 0, sessionOutput = 0, sessionCacheRead = 0, sessionTurns = 0;
  try {
    const fullReport = execSync(`node "${API_USAGE}"`, { encoding: 'utf-8' }).trim();
    const inputMatch = fullReport.match(/Input:\s*([\d,]+)/);
    const outputMatch = fullReport.match(/Output:\s*([\d,]+)/);
    const cacheMatch = fullReport.match(/Cache Read:\s*([\d,]+)/);
    const turnsMatch = fullReport.match(/Turns:\s*(\d+)/);
    if (inputMatch) sessionInput = parseInt(inputMatch[1].replace(/,/g, ''));
    if (outputMatch) sessionOutput = parseInt(outputMatch[1].replace(/,/g, ''));
    if (cacheMatch) sessionCacheRead = parseInt(cacheMatch[1].replace(/,/g, ''));
    if (turnsMatch) sessionTurns = parseInt(turnsMatch[1]);
  } catch (e) {}

  // Calculate derived metrics
  const contextWindowInput = turnInput + turnCache;  // Total tokens in context window this turn
  const sessionNew = sessionInput + sessionOutput;
  const totalProcessed = sessionNew + sessionCacheRead;
  
  // Get context window size and utilization
  const currentModel = getCurrentModel();
  const contextWindowSize = getContextWindowSize(currentModel);
  const utilizationPercent = contextWindowSize > 0 ? (contextWindowInput / contextWindowSize) * 100 : 0;
  const utilizationEmoji = getUtilizationEmoji(utilizationPercent);
  const utilizationBar = getUtilizationBar(utilizationPercent);
  
  // Format remaining capacity
  const remainingTokens = Math.max(0, contextWindowSize - contextWindowInput);
  const remainingPercent = Math.max(0, 100 - utilizationPercent);
  
  // Output clear report
  console.log(`📊 **Turn #${sessionTurns}**`);
  console.log(`   New: ${format(turnInput)} in / ${format(turnOutput)} out`);
  console.log(`   Context: ${format(turnCache)} cached (system prompt + files + history)`);
  console.log(`   Tools: ${toolCount} calls`);
  console.log(`📊 **Context Window** ${utilizationEmoji}`);
  console.log(`   Input: ${format(contextWindowInput)} / ${format(contextWindowSize)} tokens (${utilizationPercent.toFixed(1)}%)`);
  console.log(`   [${utilizationBar}] ${remainingPercent.toFixed(0)}% remaining (${format(remainingTokens)} tokens)`);
  console.log(`📊 **Session**`);
  console.log(`   New tokens: ${format(sessionNew)} (${format(sessionInput)} in / ${format(sessionOutput)} out)`);
  console.log(`   Total processed: ${format(totalProcessed)} (includes ${format(sessionCacheRead)} cache re-reads)`);
  
  // Add warning if approaching context limit
  if (utilizationPercent >= 75) {
    console.log(``);
    console.log(`⚠️  **Warning:** Context window is ${utilizationPercent >= 90 ? 'critically' : 'highly'} utilized!`);
    if (utilizationPercent >= 90) {
      console.log(`   Consider: Starting a new session (/new) or reducing conversation length`);
    } else {
      console.log(`   Consider: Summarizing old context or archiving to memory files`);
    }
  }
}

main();
