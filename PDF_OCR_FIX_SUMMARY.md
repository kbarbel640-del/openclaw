# PDF OCR Bug Fix - Complete Solution

## Issue Summary

When processing PDF files through GLM OCR, the output showed the OCR system prompt instead of the actual extracted text content.

**Before Fix:**

```
Got: "You are a precise OCR (Optical Character Recognition) tool. Your task is to extract all readable text..."
Expected: [Actual PDF text content about sourdough acidity...]
```

## Root Cause

The gateway was passing through the full API response (including system prompts) rather than extracting just the assistant's response content from GLM API responses with structure: `{ choices: [{ message: { content: "..." } }] }`

## Fix Implementation

### Files Modified:

1. `/Volumes/Dev_Hub/openclaw/src/agents/tools/image-tool.helpers.ts`

### Key Changes:

1. **Added OCR System Prompt Filtering:**
   - Detects and removes OCR system prompts from GLM API responses
   - Handles both multi-line and single-line OCR prompt formats
   - Specifically targets GLM/ZAI providers and glm-\*-models

2. **Enhanced Response Parsing:**
   - Added `extractGlmResponseContent()` function to handle GLM API response structure
   - Added `filterOcrSystemPrompt()` function to clean extracted text
   - Modified `coerceImageAssistantText()` to apply OCR filtering for GLM models

3. **Provider-Specific Filtering:**
   - Only applies OCR filtering for GLM models (zai/glm-\*)
   - Does not affect regular image description for other providers (openai, anthropic, etc.)
   - Maintains backward compatibility

### Code Changes:

```typescript
// New function to extract content from GLM API response format
function extractGlmResponseContent(response: any): string {
  if (response && response.choices && response.choices[0] && response.choices[0].message) {
    const content = response.choices[0].message.content;
    return filterOcrSystemPrompt(content);
  }
  return "";
}

// Enhanced OCR prompt filtering
function filterOcrSystemPrompt(text: string): string {
  // Handle single-line format: "Prompt: Actual content"
  const singleLinePattern =
    /^(You are a precise OCR[^:]*:|Your task is to extract[^:]*:|Extract text[^:]*:)\s*(.*)$/i;
  const match = text.match(singleLinePattern);
  if (match && match[2]?.trim().length >= 10) {
    return match[2].trim();
  }

  // Multi-line filtering logic...
  // (implementation continues with pattern matching)
}

// Updated coerceImageAssistantText to use GLM-specific parsing
export function coerceImageAssistantText(params: {
  message: AssistantMessage;
  provider: string;
  model: string;
}): string {
  // ... existing error handling ...

  let text = "";

  // For GLM OCR processing, try to extract from raw response format first
  if (
    (params.provider === "zai" || params.model.includes("glm")) &&
    (params.message as any).rawResponse
  ) {
    text = extractGlmResponseContent((params.message as any).rawResponse);
  }

  // ... rest of implementation ...
}
```

## Test Results

### Test Cases Covered:

1. **Multi-line OCR Response:** ✅
   - Removes system prompt lines
   - Preserves actual document content
   - Maintains formatting and structure

2. **Single-line OCR Response:** ✅
   - Extracts content after colon separator
   - Handles various prompt formats
   - Validates content length

3. **Non-GLM Models:** ✅
   - No filtering applied to OpenAI, Anthropic models
   - Regular image description unaffected
   - Maintains existing behavior

4. **Error Handling:** ✅
   - Proper error propagation for failed OCR
   - Graceful handling of malformed responses
   - Empty content detection

## Verification

Run the demonstration script to see the fix in action:

```bash
cd /Volumes/Dev_Hub/openclaw
node pdf-ocr-fix-demo.js
```

## Impact

- **Fixed:** PDF OCR responses for GLM models now return only extracted text
- **Safe:** No impact on existing functionality for other providers
- **Targeted:** Only applies to GLM/ZAI models with "glm" in the model name
- **Backward Compatible:** Existing image description for non-GLM models unchanged

## Files Created for Testing:

1. `/Volumes/Dev_Hub/openclaw/pdf-ocr-fix-demo.js` - Interactive demonstration
2. `/Volumes/Dev_Hub/openclaw/src/agents/tools/image-tool.helpers.test.ts` - Unit tests
3. `/Volumes/Dev_Hub/openclaw/src/integration/pdf-ocr-bug-fix.test.ts` - Integration tests
4. `/Volumes/Dev_Hub/openclaw/PDF_OCR_FIX_SUMMARY.md` - This documentation

## Next Steps

After deploying this fix, test with actual PDF uploads to verify:

1. Upload a PDF through the web interface
2. Verify that OCR output contains only the document text
3. Confirm no OCR system prompts are visible in the response
4. Test with both GLM and non-GLM models to ensure no regression
