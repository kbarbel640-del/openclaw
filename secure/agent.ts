/**
 * AssureBot - Agent Core
 *
 * Minimal AI agent that handles conversations with image support.
 * Direct API calls to Anthropic or OpenAI - no intermediaries.
 * Supports tool calling for code execution.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { SecureConfig } from "./config.js";
import type { AuditLogger } from "./audit.js";
import type { SandboxRunner, SandboxResult } from "./sandbox.js";

export type ImageContent = {
  type: "image";
  data: string; // base64
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
};

export type TextContent = {
  type: "text";
  text: string;
};

export type MessageContent = string | (TextContent | ImageContent)[];

export type Message = {
  role: "user" | "assistant";
  content: MessageContent;
};

export type AgentResponse = {
  text: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
};

export type AgentCore = {
  chat: (messages: Message[], systemPrompt?: string) => Promise<AgentResponse>;
  analyzeImage: (imageData: string, mediaType: ImageContent["mediaType"], prompt?: string) => Promise<AgentResponse>;
  provider: "anthropic" | "openai" | "openrouter";
  setSandbox: (sandbox: SandboxRunner) => void;
};

// Tool definitions for code execution
const CODE_EXECUTION_TOOL: Anthropic.Tool = {
  name: "execute_code",
  description: "Execute code in a sandboxed environment. Use this when the user asks you to run, test, or execute code. Supports: python, javascript, typescript, bash, rust, go, c, cpp, java, ruby, php.",
  input_schema: {
    type: "object",
    properties: {
      language: {
        type: "string",
        description: "Programming language: python, javascript, typescript, bash, rust, go, c, cpp, java, ruby, php",
        enum: ["python", "javascript", "typescript", "bash", "rust", "go", "c", "cpp", "java", "ruby", "php"],
      },
      code: {
        type: "string",
        description: "The code to execute",
      },
    },
    required: ["language", "code"],
  },
};

// OpenAI-compatible tool format
const CODE_EXECUTION_TOOL_OPENAI: OpenAI.ChatCompletionTool = {
  type: "function",
  function: {
    name: "execute_code",
    description: "Execute code in a sandboxed environment. Use this when the user asks you to run, test, or execute code. Supports: python, javascript, typescript, bash, rust, go, c, cpp, java, ruby, php.",
    parameters: {
      type: "object",
      properties: {
        language: {
          type: "string",
          description: "Programming language: python, javascript, typescript, bash, rust, go, c, cpp, java, ruby, php",
          enum: ["python", "javascript", "typescript", "bash", "rust", "go", "c", "cpp", "java", "ruby", "php"],
        },
        code: {
          type: "string",
          description: "The code to execute",
        },
      },
      required: ["language", "code"],
    },
  },
};

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_OPENAI_MODEL = "gpt-4o";
const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-3.5-sonnet";

const DEFAULT_SYSTEM_PROMPT = `You are AssureBot, a helpful AI assistant running as a secure Telegram bot.

You are direct, concise, and helpful. You can:
- Answer questions and have conversations
- Analyze images and documents shared with you
- Help with coding and technical tasks
- Execute code in a secure sandbox (use the execute_code tool)
- Summarize content and extract information

## Code Execution
When users ask you to run, test, or execute code, USE THE execute_code TOOL directly. Don't ask them to use commands - just run the code for them.
- If a user says "run this python code", use the execute_code tool with language="python"
- If a user shares code and asks you to test it, execute it directly
- If a user asks you to demonstrate code, run it and show the output

Examples of when to use execute_code:
- "Can you run this for me?" → Use execute_code
- "Test this python code" → Use execute_code
- "Execute this script" → Use execute_code
- "What does this code output?" → Use execute_code and show result

## Available Manual Commands (for users who prefer slash commands)
- /js <code> - Run JavaScript
- /python <code> - Run Python
- /ts <code> - Run TypeScript
- /bash <code> - Run shell commands
- /run <lang> <code> - Run any language
- /status - Check bot status
- /clear - Clear conversation history

Be security-conscious:
- Never reveal API keys, tokens, or secrets
- Don't execute commands that could harm the system
- Warn users about potentially dangerous operations`;

function createAnthropicAgent(config: SecureConfig, audit: AuditLogger): AgentCore {
  const client = new Anthropic({
    apiKey: config.ai.apiKey,
  });

  const model = config.ai.model || DEFAULT_ANTHROPIC_MODEL;
  let sandbox: SandboxRunner | null = null;

  function convertContent(content: MessageContent): Anthropic.MessageParam["content"] {
    if (typeof content === "string") {
      return content;
    }
    return content.map((part) => {
      if (part.type === "text") {
        return { type: "text" as const, text: part.text };
      }
      return {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: part.mediaType,
          data: part.data,
        },
      };
    });
  }

  async function executeCodeTool(language: string, code: string): Promise<string> {
    if (!sandbox) {
      return "Error: Sandbox is not configured. Code execution is unavailable.";
    }

    const isAvailable = await sandbox.isAvailable();
    if (!isAvailable) {
      return `Error: Sandbox unavailable. Backend: ${sandbox.backend}`;
    }

    try {
      const result = await sandbox.runCode(language, code);
      const output = result.stdout || result.stderr || "(no output)";
      const status = result.exitCode === 0 ? "Success" : `Failed (exit ${result.exitCode})`;
      const timeout = result.timedOut ? " [TIMED OUT]" : "";

      return `${status}${timeout}\nDuration: ${result.durationMs}ms\n\nOutput:\n${output.slice(0, 5000)}`;
    } catch (err) {
      return `Error executing code: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return {
    provider: "anthropic",

    setSandbox(sb: SandboxRunner): void {
      sandbox = sb;
    },

    async chat(messages: Message[], systemPrompt?: string): Promise<AgentResponse> {
      try {
        // Build initial messages
        const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
          role: m.role,
          content: convertContent(m.content),
        }));

        // Include tools only if sandbox is available
        const tools = sandbox ? [CODE_EXECUTION_TOOL] : undefined;

        let response = await client.messages.create({
          model,
          max_tokens: 4096,
          system: systemPrompt || DEFAULT_SYSTEM_PROMPT,
          messages: anthropicMessages,
          tools,
        });

        let totalInputTokens = response.usage.input_tokens;
        let totalOutputTokens = response.usage.output_tokens;

        // Handle tool calls in a loop (max 5 iterations to prevent infinite loops)
        let iterations = 0;
        while (response.stop_reason === "tool_use" && iterations < 5) {
          iterations++;

          // Find tool use blocks
          const toolUseBlocks = response.content.filter(
            (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
          );

          // Process each tool call
          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const toolUse of toolUseBlocks) {
            if (toolUse.name === "execute_code") {
              const input = toolUse.input as { language: string; code: string };
              audit.sandbox({
                command: `[AI:${input.language}] ${input.code.slice(0, 100)}...`,
                exitCode: 0,
                durationMs: 0,
              });
              const result = await executeCodeTool(input.language, input.code);
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: result,
              });
            }
          }

          // Continue conversation with tool results
          anthropicMessages.push({
            role: "assistant",
            content: response.content,
          });
          anthropicMessages.push({
            role: "user",
            content: toolResults,
          });

          response = await client.messages.create({
            model,
            max_tokens: 4096,
            system: systemPrompt || DEFAULT_SYSTEM_PROMPT,
            messages: anthropicMessages,
            tools,
          });

          totalInputTokens += response.usage.input_tokens;
          totalOutputTokens += response.usage.output_tokens;
        }

        // Extract final text response
        const text = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("\n");

        return {
          text,
          usage: {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
          },
        };
      } catch (err) {
        audit.error({
          error: `Anthropic API error: ${err instanceof Error ? err.message : String(err)}`,
        });
        throw err;
      }
    },

    async analyzeImage(
      imageData: string,
      mediaType: ImageContent["mediaType"],
      prompt = "What's in this image? Describe it in detail."
    ): Promise<AgentResponse> {
      const messages: Message[] = [
        {
          role: "user",
          content: [
            { type: "image", data: imageData, mediaType },
            { type: "text", text: prompt },
          ],
        },
      ];
      return this.chat(messages);
    },
  };
}

function createOpenAIAgent(config: SecureConfig, audit: AuditLogger): AgentCore {
  const client = new OpenAI({
    apiKey: config.ai.apiKey,
  });

  const model = config.ai.model || DEFAULT_OPENAI_MODEL;
  let sandbox: SandboxRunner | null = null;

  type OpenAIContent = OpenAI.ChatCompletionContentPart[];

  function convertContent(content: MessageContent): string | OpenAIContent {
    if (typeof content === "string") {
      return content;
    }
    return content.map((part) => {
      if (part.type === "text") {
        return { type: "text" as const, text: part.text };
      }
      return {
        type: "image_url" as const,
        image_url: {
          url: `data:${part.mediaType};base64,${part.data}`,
        },
      };
    });
  }

  async function executeCodeTool(language: string, code: string): Promise<string> {
    if (!sandbox) {
      return "Error: Sandbox is not configured. Code execution is unavailable.";
    }

    const isAvailable = await sandbox.isAvailable();
    if (!isAvailable) {
      return `Error: Sandbox unavailable. Backend: ${sandbox.backend}`;
    }

    try {
      const result = await sandbox.runCode(language, code);
      const output = result.stdout || result.stderr || "(no output)";
      const status = result.exitCode === 0 ? "Success" : `Failed (exit ${result.exitCode})`;
      const timeout = result.timedOut ? " [TIMED OUT]" : "";

      return `${status}${timeout}\nDuration: ${result.durationMs}ms\n\nOutput:\n${output.slice(0, 5000)}`;
    } catch (err) {
      return `Error executing code: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return {
    provider: "openai",

    setSandbox(sb: SandboxRunner): void {
      sandbox = sb;
    },

    async chat(messages: Message[], systemPrompt?: string): Promise<AgentResponse> {
      try {
        const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt || DEFAULT_SYSTEM_PROMPT },
        ];

        for (const m of messages) {
          if (m.role === "user") {
            openaiMessages.push({
              role: "user",
              content: convertContent(m.content),
            });
          } else {
            openaiMessages.push({
              role: "assistant",
              content: typeof m.content === "string" ? m.content : "",
            });
          }
        }

        // Include tools only if sandbox is available
        const tools = sandbox ? [CODE_EXECUTION_TOOL_OPENAI] : undefined;

        let response = await client.chat.completions.create({
          model,
          max_tokens: 4096,
          messages: openaiMessages,
          tools,
        });

        let totalInputTokens = response.usage?.prompt_tokens || 0;
        let totalOutputTokens = response.usage?.completion_tokens || 0;

        // Handle tool calls in a loop (max 5 iterations)
        let iterations = 0;
        while (response.choices[0]?.finish_reason === "tool_calls" && iterations < 5) {
          iterations++;

          const toolCalls = response.choices[0]?.message?.tool_calls || [];

          // Add assistant message with tool calls
          openaiMessages.push({
            role: "assistant",
            content: response.choices[0]?.message?.content || null,
            tool_calls: toolCalls,
          });

          // Process each tool call
          for (const toolCall of toolCalls) {
            if (toolCall.function.name === "execute_code") {
              const args = JSON.parse(toolCall.function.arguments) as { language: string; code: string };
              audit.sandbox({
                command: `[AI:${args.language}] ${args.code.slice(0, 100)}...`,
                exitCode: 0,
                durationMs: 0,
              });
              const result = await executeCodeTool(args.language, args.code);
              openaiMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: result,
              });
            }
          }

          response = await client.chat.completions.create({
            model,
            max_tokens: 4096,
            messages: openaiMessages,
            tools,
          });

          totalInputTokens += response.usage?.prompt_tokens || 0;
          totalOutputTokens += response.usage?.completion_tokens || 0;
        }

        const text = response.choices[0]?.message?.content || "";

        return {
          text,
          usage: {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
          },
        };
      } catch (err) {
        audit.error({
          error: `OpenAI API error: ${err instanceof Error ? err.message : String(err)}`,
        });
        throw err;
      }
    },

    async analyzeImage(
      imageData: string,
      mediaType: ImageContent["mediaType"],
      prompt = "What's in this image? Describe it in detail."
    ): Promise<AgentResponse> {
      const messages: Message[] = [
        {
          role: "user",
          content: [
            { type: "image", data: imageData, mediaType },
            { type: "text", text: prompt },
          ],
        },
      ];
      return this.chat(messages);
    },
  };
}

function createOpenRouterAgent(config: SecureConfig, audit: AuditLogger): AgentCore {
  // OpenRouter uses OpenAI-compatible API
  const client = new OpenAI({
    apiKey: config.ai.apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://github.com/TNovs1/moltbot",
      "X-Title": "AssureBot",
    },
  });

  const model = config.ai.model || DEFAULT_OPENROUTER_MODEL;
  let sandbox: SandboxRunner | null = null;

  type OpenAIContent = OpenAI.ChatCompletionContentPart[];

  function convertContent(content: MessageContent): string | OpenAIContent {
    if (typeof content === "string") {
      return content;
    }
    return content.map((part) => {
      if (part.type === "text") {
        return { type: "text" as const, text: part.text };
      }
      return {
        type: "image_url" as const,
        image_url: {
          url: `data:${part.mediaType};base64,${part.data}`,
        },
      };
    });
  }

  async function executeCodeTool(language: string, code: string): Promise<string> {
    if (!sandbox) {
      return "Error: Sandbox is not configured. Code execution is unavailable.";
    }

    const isAvailable = await sandbox.isAvailable();
    if (!isAvailable) {
      return `Error: Sandbox unavailable. Backend: ${sandbox.backend}`;
    }

    try {
      const result = await sandbox.runCode(language, code);
      const output = result.stdout || result.stderr || "(no output)";
      const status = result.exitCode === 0 ? "Success" : `Failed (exit ${result.exitCode})`;
      const timeout = result.timedOut ? " [TIMED OUT]" : "";

      return `${status}${timeout}\nDuration: ${result.durationMs}ms\n\nOutput:\n${output.slice(0, 5000)}`;
    } catch (err) {
      return `Error executing code: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return {
    provider: "openrouter",

    setSandbox(sb: SandboxRunner): void {
      sandbox = sb;
    },

    async chat(messages: Message[], systemPrompt?: string): Promise<AgentResponse> {
      try {
        const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt || DEFAULT_SYSTEM_PROMPT },
        ];

        for (const m of messages) {
          if (m.role === "user") {
            openaiMessages.push({
              role: "user",
              content: convertContent(m.content),
            });
          } else {
            openaiMessages.push({
              role: "assistant",
              content: typeof m.content === "string" ? m.content : "",
            });
          }
        }

        // Include tools only if sandbox is available
        const tools = sandbox ? [CODE_EXECUTION_TOOL_OPENAI] : undefined;

        let response = await client.chat.completions.create({
          model,
          max_tokens: 4096,
          messages: openaiMessages,
          tools,
        });

        let totalInputTokens = response.usage?.prompt_tokens || 0;
        let totalOutputTokens = response.usage?.completion_tokens || 0;

        // Handle tool calls in a loop (max 5 iterations)
        let iterations = 0;
        while (response.choices[0]?.finish_reason === "tool_calls" && iterations < 5) {
          iterations++;

          const toolCalls = response.choices[0]?.message?.tool_calls || [];

          // Add assistant message with tool calls
          openaiMessages.push({
            role: "assistant",
            content: response.choices[0]?.message?.content || null,
            tool_calls: toolCalls,
          });

          // Process each tool call
          for (const toolCall of toolCalls) {
            if (toolCall.function.name === "execute_code") {
              const args = JSON.parse(toolCall.function.arguments) as { language: string; code: string };
              audit.sandbox({
                command: `[AI:${args.language}] ${args.code.slice(0, 100)}...`,
                exitCode: 0,
                durationMs: 0,
              });
              const result = await executeCodeTool(args.language, args.code);
              openaiMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: result,
              });
            }
          }

          response = await client.chat.completions.create({
            model,
            max_tokens: 4096,
            messages: openaiMessages,
            tools,
          });

          totalInputTokens += response.usage?.prompt_tokens || 0;
          totalOutputTokens += response.usage?.completion_tokens || 0;
        }

        const text = response.choices[0]?.message?.content || "";

        return {
          text,
          usage: {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
          },
        };
      } catch (err) {
        audit.error({
          error: `OpenRouter API error: ${err instanceof Error ? err.message : String(err)}`,
        });
        throw err;
      }
    },

    async analyzeImage(
      imageData: string,
      mediaType: ImageContent["mediaType"],
      prompt = "What's in this image? Describe it in detail."
    ): Promise<AgentResponse> {
      const messages: Message[] = [
        {
          role: "user",
          content: [
            { type: "image", data: imageData, mediaType },
            { type: "text", text: prompt },
          ],
        },
      ];
      return this.chat(messages);
    },
  };
}

export function createAgent(config: SecureConfig, audit: AuditLogger): AgentCore {
  if (config.ai.provider === "anthropic") {
    return createAnthropicAgent(config, audit);
  }
  if (config.ai.provider === "openrouter") {
    return createOpenRouterAgent(config, audit);
  }
  return createOpenAIAgent(config, audit);
}

/**
 * Simple in-memory conversation store
 * For Railway, consider using Redis or persistent storage
 */
export type ConversationStore = {
  get: (userId: number) => Message[];
  add: (userId: number, message: Message) => void;
  clear: (userId: number) => void;
};

const MAX_HISTORY = 20;

export function createConversationStore(): ConversationStore {
  const conversations = new Map<number, Message[]>();

  return {
    get(userId: number): Message[] {
      return conversations.get(userId) || [];
    },

    add(userId: number, message: Message): void {
      const history = conversations.get(userId) || [];
      history.push(message);
      // Keep only last N messages
      if (history.length > MAX_HISTORY) {
        history.splice(0, history.length - MAX_HISTORY);
      }
      conversations.set(userId, history);
    },

    clear(userId: number): void {
      conversations.delete(userId);
    },
  };
}
