#!/usr/bin/env node

/**
 * Session Report Generator
 * Generates deterministic token and tool call reports for OpenClaw sessions
 * 
 * Usage:
 *   node session-report.js --input "user message" --output "assistant message" --tools 3
 *   node session-report.js --session /path/to/session.jsonl --last
 */

const fs = require('fs');

// Deterministic token counter (same as tokenize.js)
function countTokens(text, model = 'default') {
  if (!text || typeof text !== 'string') return 0;
  
  let tokens = 0;
  
  // Words (~4 chars per token for English)
  const words = text.match(/[a-zA-Z]+/g) || [];
  words.forEach(w => tokens += Math.ceil(w.length / 4));
  
  // Numbers (1-2 tokens each)
  tokens += (text.match(/\d+/g) || []).length;
  
  // CJK characters (1 token each)
  tokens += (text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
  
  // Whitespace sequences
  tokens += (text.match(/\s+/g) || []).length;
  
  // Punctuation and special chars
  tokens += (text.match(/[.,!?;:'"()\[\]{}<>=+\-*/\\|&^%$#@!~`]/g) || []).length;
  
  // Model multipliers
  const multipliers = {
    'gpt-4': 1.0, 'claude': 0.95, 'gemini': 1.05,
    'minimax': 1.0, 'glm': 1.1, 'default': 1.0
  };
  
  const mult = multipliers[model.toLowerCase()] || 1.0;
  return Math.ceil(tokens * mult);
}

function generateReport(input, output, toolCalls, model = 'default') {
  const inputTokens = countTokens(input, model);
  const outputTokens = countTokens(output, model);
  const totalTokens = inputTokens + outputTokens;
  
  const report = {
    timestamp: new Date().toISOString(),
    model,
    input: {
      text: input.length > 100 ? input.substring(0, 100) + '...' : input,
      length: input.length,
      tokens: inputTokens
    },
    output: {
      text: output.length > 100 ? output.substring(0, 100) + '...' : output,
      length: output.length,
      tokens: outputTokens
    },
    toolCalls,
    total: {
      tokens: totalTokens,
      messages: toolCalls > 0 ? 2 + toolCalls : 2
    }
  };
  
  return report;
}

function formatReport(report, format = 'compact') {
  if (format === 'json') {
    return JSON.stringify(report, null, 2);
  }
  
  // Compact format for appending to messages
  const lines = [
    `📊 **Session Metrics**`,
    `├ Input:  ${report.input.tokens} tokens (${report.input.length} chars)`,
    `├ Output: ${report.output.tokens} tokens (${report.output.length} chars)`,
    `├ Tools:  ${report.toolCalls} calls`,
    `└ Total:  ${report.total.tokens} tokens`
  ];
  
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  
  let input = '';
  let output = '';
  let toolCalls = 0;
  let model = 'default';
  let format = 'compact';
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--input') {
      input = args[++i] || '';
    } else if (arg === '--output') {
      output = args[++i] || '';
    } else if (arg === '--tools') {
      toolCalls = parseInt(args[++i]) || 0;
    } else if (arg === '--model' || arg === '-m') {
      model = args[++i] || 'default';
    } else if (arg === '--json') {
      format = 'json';
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Session Report Generator - Deterministic token/tool metrics

Usage:
  node session-report.js --input "text" --output "text" --tools N
  echo '{"input":"...", "output":"...", "tools":3}' | node session-report.js --stdin

Options:
  --input   Input text (user message)
  --output  Output text (assistant message)
  --tools   Number of tool calls made
  --model   Model name for estimation (default, minimax, claude, gemini, glm)
  --json    Output as JSON
  --help    Show this help
      `);
      process.exit(0);
    }
  }
  
  // Read from stdin if no input
  if (!input && !process.stdin.isTTY) {
    try {
      const stdin = fs.readFileSync(0, 'utf-8');
      const data = JSON.parse(stdin);
      input = data.input || '';
      output = data.output || '';
      toolCalls = data.tools || 0;
      model = data.model || model;
    } catch {
      // Use args
    }
  }
  
  const report = generateReport(input, output, toolCalls, model);
  console.log(formatReport(report, format));
}

main();
