#!/usr/bin/env node

/**
 * Demonstration of the PDF OCR bug fix
 *
 * BEFORE: GLM OCR returns system prompt instead of extracted text
 * AFTER: Only actual document content is returned
 */

console.log("=== PDF OCR Bug Fix Demonstration ===\n");

// Simulate the bug scenario
const buggyOcrResponse = `You are a precise OCR (Optical Character Recognition) tool. Your task is to extract all readable text from this PDF document.

ACTUAL PDF CONTENT:
Sourdough Acidity Levels and Fermentation

The pH level of sourdough starter typically ranges from 3.5 to 4.2 during active fermentation. This acidic environment helps develop the characteristic tangy flavor and natural preservatives.

Optimal fermentation temperature is between 75-80°F (24-27°C) for most wild yeast strains. The ratio of water to flour should be approximately 1:1 by weight for a typical stiff starter.

For best results, feed your starter regularly every 12-24 hours at room temperature, or every 3-4 days if refrigerated.`;

console.log("❌ BEFORE FIX - Returns system prompt + content:");
console.log(buggyOcrResponse.substring(0, 200) + "...");

// Simulate the fix - filter out OCR system prompts
function filterOcrSystemPrompt(text) {
  // Handle single-line OCR responses that have format: "Prompt: Actual content"
  const singleLinePattern =
    /^(You are a precise OCR[^:]*:|Your task is to extract[^:]*:|Extract text[^:]*:|Please extract[^:]*:|OCR[^:]*:|Extract all readable text[^:]*:)\s*(.*)$/i;
  const singleLineMatch = text.match(singleLinePattern);
  if (singleLineMatch) {
    const actualContent = singleLineMatch[2].trim();
    // Only return if there's substantial content (not just short fragments)
    if (actualContent.length >= 10) {
      return actualContent;
    }
  }

  // Handle multi-line OCR responses
  const ocrSystemPatterns = [
    /^You are a precise OCR.*$/im,
    /^Your task is to extract.*$/im,
    /^Please extract.*$/im,
    /^Extract all readable text.*$/im,
    /^OCR.*$/im,
    /^Optical Character Recognition.*$/im,
  ];

  const lines = text.split("\n");
  const filteredLines = [];
  let inOcrPrompt = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    const isOcrPromptLine = ocrSystemPatterns.some((pattern) => pattern.test(trimmedLine));

    if (isOcrPromptLine) {
      inOcrPrompt = true;
      continue;
    }

    if (!inOcrPrompt) {
      filteredLines.push(line);
    } else {
      // For multi-line prompts, check if this line looks like actual content
      if (
        !isOcrPromptLine &&
        trimmedLine.length > 5 &&
        !trimmedLine.match(/^(and|or|but|so|then|next|finally)$/i)
      ) {
        inOcrPrompt = false;
        filteredLines.push(line);
      }
    }
  }

  return filteredLines.join("\n").trim();
}

const fixedText = filterOcrSystemPrompt(buggyOcrResponse);

console.log("\n✅ AFTER FIX - Returns only extracted content:");
console.log(fixedText);

console.log("\n=== Fix Summary ===");
console.log("• Removed OCR system prompt lines");
console.log("• Preserved actual document content");
console.log("• Only applies to GLM OCR models (zai/glm)");
console.log("• Doesn't affect regular image description for other models");

// Test with GLM API response format
console.log("\n=== GLM API Response Format Fix ===");
const glmApiResponse = {
  choices: [
    {
      message: {
        content:
          "You are a precise OCR tool. Extract text from this invoice: Invoice #12345, Amount: $1,234.56",
        role: "assistant",
      },
    },
  ],
};

function extractGlmResponseContent(response) {
  if (response && response.choices && response.choices[0] && response.choices[0].message) {
    const content = response.choices[0].message.content;
    return filterOcrSystemPrompt(content);
  }
  return "";
}

const extractedContent = extractGlmResponseContent(glmApiResponse);
console.log("Raw GLM response content:", glmApiResponse.choices[0].message.content);
console.log("Extracted content:", extractedContent);

// Test with improved single-line OCR prompt handling
const singleLineOcrText =
  "You are a precise OCR tool. Extract text from this invoice: Invoice #12345, Amount: $1,234.56";
const betterFilteredText = filterOcrSystemPrompt(singleLineOcrText);
console.log("\nSingle-line OCR test:");
console.log("Original:", singleLineOcrText);
console.log("Filtered:", betterFilteredText);

console.log("\n🎉 PDF OCR bug has been fixed!");
