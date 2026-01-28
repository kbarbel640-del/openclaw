import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runEmbeddedPiAgent } from "../agents/pi-embedded.js";
import { DEFAULT_USER_FILENAME } from "../agents/workspace.js";
import { resolveConfiguredModelRef } from "../agents/model-selection.js";
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "../agents/defaults.js";
import type { MoltbotConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import { shortenHomePath } from "../utils.js";
import type { WizardPrompter } from "../wizard/prompts.js";

export type UserInterviewAnswers = {
  name: string;
  preferredName?: string;
  interests?: string;
  riskPreference?: "always-ask" | "low-risk-auto" | "trust-me";
};

export async function conductUserInterview(
  prompter: WizardPrompter,
): Promise<UserInterviewAnswers> {
  const name = await prompter.text({
    message: "What's your name?",
    placeholder: "Alex",
    validate: (value) => {
      const trimmed = value.trim();
      return !trimmed ? "Name is required" : undefined;
    },
  });

  const preferredNameRaw = await prompter.text({
    message: "What should I call you?",
    placeholder: name,
    initialValue: name,
  });
  const preferredName = preferredNameRaw.trim() || name;

  const interestsRaw = await prompter.text({
    message: "What are your main interests or focus areas?",
    placeholder: "software development, AI, productivity tools",
  });
  const interests = interestsRaw.trim() || undefined;

  await prompter.note(
    [
      "Risk preference helps me understand when to ask for approval.",
      "Examples of non-reversible actions:",
      "- Sending emails or messages",
      "- Making payments or purchases",
      "- Deleting files permanently",
      "- Publishing content publicly",
    ].join("\n"),
    "Risk Preference",
  );

  const riskPreference = (await prompter.select({
    message: "Should I ask before non-reversible actions?",
    options: [
      {
        value: "always-ask",
        label: "Always ask (safest)",
        hint: "I'll confirm before any risky action",
      },
      {
        value: "low-risk-auto",
        label: "Auto-approve low-risk actions",
        hint: "I'll handle routine tasks but ask for critical ones",
      },
      {
        value: "trust-me",
        label: "Trust me with everything",
        hint: "I'll make decisions autonomously (requires strong oversight)",
      },
    ],
    initialValue: "always-ask",
  })) as "always-ask" | "low-risk-auto" | "trust-me";

  return { name, preferredName, interests, riskPreference };
}

function generateUserMarkdownSimple(answers: UserInterviewAnswers): string {
  const riskPreferenceText = {
    "always-ask":
      "Prefers maximum safety: always ask before any non-reversible action (sending messages, making payments, deleting files, publishing content).",
    "low-risk-auto":
      "Comfortable with routine automation: auto-approve low-risk tasks, but always ask before critical actions like payments, permanent deletions, or public publishing.",
    "trust-me":
      "Trusts autonomous decision-making: can proceed with most actions independently, but still values transparency and explanations.",
  };

  const riskContext = answers.riskPreference
    ? riskPreferenceText[answers.riskPreference]
    : "Risk preference not specified.";
  const interestsNote = answers.interests
    ? `Interested in ${answers.interests}.`
    : "Interests to be discovered over time.";
  const interestsContext = answers.interests
    ? `${answers.name} is interested in ${answers.interests}. The assistant should be prepared to help with tasks, questions, and projects related to these areas.`
    : `${answers.name}'s specific interests will become clearer through conversation. The assistant should actively learn and adapt to their needs.`;

  return `# USER.md - About Your Human

*Learn about the person you're helping. Update this as you go.*

- **Name:** ${answers.name}
- **What to call them:** ${answers.preferredName || answers.name}
- **Notes:** ${interestsNote}

## Context

${interestsContext}

**Risk Preference:** ${riskContext}

The assistant should tailor its approach based on this information, always prioritizing ${answers.preferredName || answers.name}'s preferences and safety guidelines.

---

The more you know, the better you can help. But remember — you're learning about a person, not building a dossier. Respect the difference.`;
}

function buildUserProfilePrompt(answers: UserInterviewAnswers): string {
  const riskPreferenceDescription = {
    "always-ask": "Always ask for approval before any non-reversible action (safest)",
    "low-risk-auto":
      "Auto-approve low-risk routine tasks, but ask for critical actions like payments or deletions",
    "trust-me": "Full autonomy - make decisions independently (requires strong oversight)",
  };

  const riskDesc = answers.riskPreference
    ? riskPreferenceDescription[answers.riskPreference]
    : undefined;
  const templateContent = `# USER.md - About Your Human

*Learn about the person you're helping. Update this as you go.*

- **Name:** ${answers.name}
- **What to call them:** ${answers.preferredName || answers.name}
- **Notes:** [Brief one-line summary]

## Context

[2-3 paragraphs with interests and risk preference guidance]

---

The more you know, the better you can help. But remember — you're learning about a person, not building a dossier. Respect the difference.`;

  return `You are helping to create a USER.md profile for a personal AI assistant.

Based on the following interview answers, generate a well-structured markdown document.

Interview Answers:
- Name: ${answers.name}
- Preferred Name: ${answers.preferredName || answers.name}
${answers.interests ? `- Interests: ${answers.interests}` : ""}
${riskDesc ? `- Risk Preference: ${riskDesc}` : ""}

Requirements:
1. Follow the USER.md template structure
2. In "Notes" section: brief summary of interests if provided
3. In "Context" section, write 2-3 paragraphs covering:
   - Their interests and focus areas
   - IMPORTANT: Their risk preference and when to ask for approval
   - How the assistant should help them

Template Structure:
${templateContent}

Output ONLY the markdown content. Start directly with "# USER.md - About Your Human".`;
}

export async function generateUserMarkdown(
  answers: UserInterviewAnswers,
  config: MoltbotConfig,
  workspaceDir: string,
): Promise<{ markdown: string; usedLLM: boolean }> {
  let tempSessionFile: string | null = null;

  try {
    const prompt = buildUserProfilePrompt(answers);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "moltbot-user-profile-"));
    tempSessionFile = path.join(tempDir, "session.jsonl");

    const modelRef = resolveConfiguredModelRef({
      cfg: config,
      defaultProvider: DEFAULT_PROVIDER,
      defaultModel: DEFAULT_MODEL,
    });

    const result = await runEmbeddedPiAgent({
      sessionId: `onboard-user-interview-${Date.now()}`,
      sessionKey: "temp:user-interview",
      sessionFile: tempSessionFile,
      workspaceDir,
      config,
      prompt,
      provider: modelRef.provider,
      model: modelRef.model,
      timeoutMs: 30_000,
      runId: `user-profile-gen-${Date.now()}`,
    });

    if (result.payloads && result.payloads.length > 0) {
      const text = result.payloads[0]?.text;
      if (text?.trim()) {
        return { markdown: text.trim(), usedLLM: true };
      }
    }

    return { markdown: generateUserMarkdownSimple(answers), usedLLM: false };
  } catch (err) {
    return { markdown: generateUserMarkdownSimple(answers), usedLLM: false };
  } finally {
    if (tempSessionFile) {
      try {
        await fs.rm(path.dirname(tempSessionFile), { recursive: true, force: true });
      } catch {}
    }
  }
}

export async function saveUserProfile(
  workspaceDir: string,
  markdown: string,
  runtime: RuntimeEnv,
): Promise<string> {
  const userPath = path.join(workspaceDir, DEFAULT_USER_FILENAME);
  await fs.writeFile(userPath, markdown, "utf-8");
  runtime.log(`✓ USER profile saved: ${shortenHomePath(userPath)}`);
  return userPath;
}
