#!/usr/bin/env node

/**
 * Deterministic Token Counter for OpenClaw Instructions
 * 
 * Counts tokens for various LLM tokenizers (GPT, Claude, Gemini, MiniMax)
 * Usage:
 *   node tokenize.js "your instruction text here"
 *   echo "text" | node tokenize.js
 *   node tokenize.js --file input.txt
 *   node tokenize.js --json '{"prompt": "text", "context": "..."}'
 */

const fs = require('fs');
const path = require('path');

// Simple BPE-style tokenizer simulation for deterministic output
// This provides consistent token counts across runs without external deps

class DeterministicTokenizer {
  constructor() {
    // Common token patterns (approximation of BPE behavior)
    this.patterns = [
      // Whitespace and special chars
      { pattern: /\s+/g, weight: 1 },
      // Numbers
      { pattern: /\d+/g, weight: 0.5 },
      // Words (English)
      { pattern: /[a-zA-Z]+/g, weight: 0.25 },
      // Punctuation
      { pattern: /[.,!?;:'"()\[\]{}]/g, weight: 1 },
      // Unicode/CJK characters (typically 1 token each)
      { pattern: /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g, weight: 1 },
      // Code symbols
      { pattern: /[{}()\[\]<>=+\-*/\\|&^%$#@!~`]/g, weight: 1 },
    ];
  }

  /**
   * Estimate token count for text
   * Deterministic: same input always produces same output
   */
  countTokens(text, model = 'default') {
    if (!text || typeof text !== 'string') return 0;
    
    let tokenCount = 0;
    let remaining = text;
    
    // Count whitespace sequences
    const whitespace = text.match(/\s+/g) || [];
    tokenCount += whitespace.length;
    remaining = remaining.replace(/\s+/g, ' ');
    
    // Count words (split on non-word chars)
    const words = remaining.match(/[a-zA-Z]+/g) || [];
    // English words: ~4 chars per token on average
    words.forEach(word => {
      tokenCount += Math.ceil(word.length / 4);
    });
    
    // Count numbers (each digit sequence is 1-2 tokens)
    const numbers = text.match(/\d+/g) || [];
    tokenCount += numbers.length;
    
    // Count CJK characters (1 token each)
    const cjk = text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g) || [];
    tokenCount += cjk.length;
    
    // Count special characters and punctuation
    const special = text.match(/[.,!?;:'"()\[\]{}<>=+\-*/\\|&^%$#@!~`]/g) || [];
    tokenCount += special.length;
    
    // Count newlines (often separate tokens)
    const newlines = (text.match(/\n/g) || []).length;
    tokenCount += newlines;
    
    // Model-specific adjustments
    const multiplier = this.getModelMultiplier(model);
    
    return Math.ceil(tokenCount * multiplier);
  }

  getModelMultiplier(model) {
    // Different models have different tokenization efficiencies
    const multipliers = {
      'gpt-4': 1.0,
      'gpt-3.5': 1.0,
      'claude': 0.95,
      'gemini': 1.05,
      'minimax': 1.0,
      'glm': 1.1,
      'default': 1.0,
    };
    
    const modelLower = model.toLowerCase();
    for (const [key, mult] of Object.entries(multipliers)) {
      if (modelLower.includes(key)) return mult;
    }
    return 1.0;
  }

  /**
   * Analyze instruction structure
   */
  analyzeInstruction(text) {
    const lines = text.split('\n');
    const codeBlocks = (text.match(/```[\s\S]*?```/g) || []).length;
    const hasJson = text.includes('{') && text.includes('}');
    const wordCount = (text.match(/\b\w+\b/g) || []).length;
    const charCount = text.length;
    
    return {
      lines: lines.length,
      codeBlocks,
      hasJson,
      wordCount,
      charCount,
    };
  }
}

// CLI Interface
function main() {
  const args = process.argv.slice(2);
  
  let input = '';
  let model = 'default';
  let outputFormat = 'text';
  let inputFile = null;
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--model' || arg === '-m') {
      model = args[++i] || 'default';
    } else if (arg === '--json' || arg === '-j') {
      outputFormat = 'json';
    } else if (arg === '--file' || arg === '-f') {
      inputFile = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Token Counter - Deterministic token estimation for OpenClaw instructions

Usage:
  node tokenize.js "your text here"
  echo "text" | node tokenize.js
  node tokenize.js --file input.txt
  node tokenize.js --json '{"prompt": "text"}'

Options:
  -m, --model <name>   Model to estimate for (gpt-4, claude, gemini, minimax, glm)
  -j, --json           Output as JSON
  -f, --file <path>    Read input from file
  -h, --help           Show this help

Examples:
  node tokenize.js "Write a hello world program"
  node tokenize.js --model claude "Explain quantum physics"
  cat instruction.txt | node tokenize.js --json
      `);
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      input = arg;
    }
  }
  
  // Read from file if specified
  if (inputFile) {
    try {
      input = fs.readFileSync(inputFile, 'utf-8');
    } catch (err) {
      console.error(`Error reading file: ${err.message}`);
      process.exit(1);
    }
  }
  
  // Read from stdin if no input
  if (!input && !process.stdin.isTTY) {
    input = fs.readFileSync(0, 'utf-8');
  }
  
  // Parse JSON input if detected
  let jsonData = null;
  try {
    jsonData = JSON.parse(input);
  } catch {
    // Not JSON, treat as plain text
  }
  
  const tokenizer = new DeterministicTokenizer();
  
  // Process input
  let result;
  if (jsonData) {
    // Sum tokens for all string values in JSON
    let totalTokens = 0;
    const breakdown = {};
    
    const countInObject = (obj, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'string') {
          const tokens = tokenizer.countTokens(value, model);
          breakdown[fullKey] = tokens;
          totalTokens += tokens;
        } else if (typeof value === 'object' && value !== null) {
          countInObject(value, fullKey);
        }
      }
    };
    
    countInObject(jsonData);
    
    result = {
      input: jsonData,
      totalTokens,
      breakdown,
      model,
    };
  } else {
    const tokens = tokenizer.countTokens(input, model);
    const analysis = tokenizer.analyzeInstruction(input);
    
    result = {
      input: input.length > 100 ? input.substring(0, 100) + '...' : input,
      inputLength: input.length,
      tokens,
      analysis,
      model,
    };
  }
  
  // Output
  if (outputFormat === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.breakdown) {
      console.log(`\n📊 Token Count: ${result.totalTokens}`);
      console.log(`Model: ${model}\n`);
      console.log('Breakdown:');
      for (const [key, tokens] of Object.entries(result.breakdown)) {
        console.log(`  ${key}: ${tokens} tokens`);
      }
    } else {
      console.log(`\n📊 Tokens: ${result.tokens}`);
      console.log(`Characters: ${result.inputLength}`);
      console.log(`Model: ${model}`);
      console.log(`\nAnalysis:`);
      console.log(`  Lines: ${result.analysis.lines}`);
      console.log(`  Words: ${result.analysis.wordCount}`);
      console.log(`  Code blocks: ${result.analysis.codeBlocks}`);
    }
  }
}

main();
