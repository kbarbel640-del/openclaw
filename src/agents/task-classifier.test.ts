import { describe, expect, it } from "vitest";
import {
  classifyTask,
  classifyComplexity,
  classifyTaskWithScores,
  isCodingTask,
  isReasoningTask,
  isVisionTask,
} from "./task-classifier.js";

describe("task-classifier", () => {
  describe("classifyTask", () => {
    describe("coding tasks", () => {
      it("detects coding-related prompts", () => {
        expect(classifyTask("Write a function to sort an array")).toBe("coding");
        expect(classifyTask("Fix the bug in the login component")).toBe("coding");
        expect(classifyTask("Implement a REST API endpoint")).toBe("coding");
        expect(classifyTask("Create a TypeScript class for user management")).toBe("coding");
        expect(classifyTask("Debug this Python script")).toBe("coding");
      });

      it("detects language-specific prompts", () => {
        expect(classifyTask("Write JavaScript code for form validation")).toBe("coding");
        expect(classifyTask("Create a Python function to parse JSON")).toBe("coding");
        expect(classifyTask("Implement this in Rust")).toBe("coding");
        expect(classifyTask("Write a Go program to handle HTTP requests")).toBe("coding");
      });

      it("detects framework-related prompts", () => {
        expect(classifyTask("Build a React component for a dashboard")).toBe("coding");
        expect(classifyTask("Create a Next.js page with server-side rendering")).toBe("coding");
        expect(classifyTask("Write a FastAPI endpoint for authentication")).toBe("coding");
        expect(classifyTask("Build a Vue component with Vuex store")).toBe("coding");
      });

      it("detects development tool prompts", () => {
        expect(classifyTask("Write a git commit message for these changes")).toBe("coding");
        expect(classifyTask("Create a Docker configuration for this app")).toBe("coding");
        expect(classifyTask("Set up npm scripts for testing")).toBe("coding");
      });

      it("detects code review and refactoring prompts", () => {
        expect(classifyTask("Review this pull request and suggest improvements")).toBe("coding");
        expect(classifyTask("Refactor this code to use async/await")).toBe("coding");
        expect(classifyTask("Optimize this database query")).toBe("coding");
      });
    });

    describe("vision tasks", () => {
      it("detects image-related prompts", () => {
        expect(classifyTask("Analyze this image and describe what you see")).toBe("vision");
        expect(classifyTask("Look at the screenshot and identify the bug")).toBe("vision");
        expect(classifyTask("What's shown in this picture?")).toBe("vision");
      });

      it("detects explicit image attachments", () => {
        expect(classifyTask("What's in [image]?")).toBe("vision");
        expect(classifyTask("Describe the attached image")).toBe("vision");
        expect(classifyTask("What do you see in this image?")).toBe("vision");
      });

      it("detects file extension patterns", () => {
        expect(classifyTask("Analyze screenshot.png")).toBe("vision");
        expect(classifyTask("What's in photo.jpg?")).toBe("vision");
        expect(classifyTask("Describe diagram.webp")).toBe("vision");
      });

      it("detects UI/design prompts", () => {
        expect(classifyTask("Look at this UI mockup and suggest improvements")).toBe("vision");
        expect(classifyTask("Analyze the wireframe design")).toBe("vision");
      });
    });

    describe("tools tasks", () => {
      it("detects OpenClaw/gateway operations prompts", () => {
        expect(classifyTask("Restart the openclaw gateway and check logs")).toBe("tools");
        expect(classifyTask("Run openclaw status --deep and analyze the output")).toBe("tools");
        expect(classifyTask("Check gateway system.info and validate Redis/Postgres")).toBe("tools");
      });

      it("detects shell/ops prompts", () => {
        expect(classifyTask("Run brew services list and check redis/postgres")).toBe("tools");
        expect(classifyTask("Use lsof to see what's listening on port 18789")).toBe("tools");
        expect(classifyTask("Tail the logs and find 429 errors")).toBe("tools");
      });
    });

    describe("reasoning tasks", () => {
      it("detects analytical prompts", () => {
        expect(classifyTask("Analyze the tradeoffs between these two approaches")).toBe(
          "reasoning",
        );
        expect(classifyTask("Compare the pros and cons of microservices")).toBe("reasoning");
        expect(classifyTask("Think through the implications of this decision")).toBe("reasoning");
      });

      it("detects planning and architecture prompts", () => {
        expect(
          classifyTask("Design an architecture for a scalable system and compare approaches"),
        ).toBe("reasoning");
        expect(classifyTask("Plan the strategy and analyze the implications")).toBe("reasoning");
        expect(classifyTask("Evaluate these options and compare the tradeoffs")).toBe("reasoning");
      });

      it("detects step-by-step reasoning requests", () => {
        expect(classifyTask("Break down the problem step by step and analyze")).toBe("reasoning");
        expect(classifyTask("Explain your reasoning logically and consider implications")).toBe(
          "reasoning",
        );
        expect(classifyTask("Derive the conclusion from these premises and evaluate")).toBe(
          "reasoning",
        );
      });
    });

    describe("general tasks", () => {
      it("returns general for non-specific prompts", () => {
        expect(classifyTask("Hello, how are you?")).toBe("general");
        expect(classifyTask("What time is it?")).toBe("general");
        expect(classifyTask("Tell me a joke")).toBe("general");
      });

      it("returns general for empty or minimal input", () => {
        expect(classifyTask("")).toBe("general");
        expect(classifyTask("   ")).toBe("general");
        expect(classifyTask("hi")).toBe("general");
      });

      it("returns general for ambiguous prompts", () => {
        expect(classifyTask("Help me with something")).toBe("general");
        expect(classifyTask("I need assistance")).toBe("general");
      });
    });

    describe("edge cases", () => {
      it("handles mixed signals appropriately", () => {
        // Vision keywords can trigger vision
        expect(classifyTask("Write code to analyze this image")).toBe("vision");

        // Vision takes priority with image attachments
        expect(classifyTask("Look at this code screenshot [image]")).toBe("vision");

        // Coding with more keywords wins
        expect(classifyTask("Write a function and implement the class")).toBe("coding");
      });

      it("handles case insensitivity", () => {
        expect(classifyTask("WRITE A FUNCTION TO IMPLEMENT")).toBe("coding");
        expect(classifyTask("ANALYZE THIS IMAGE")).toBe("vision");
        expect(classifyTask("THINK THROUGH AND ANALYZE THE TRADEOFFS")).toBe("reasoning");
      });
    });
  });

  describe("classifyTaskWithScores", () => {
    it("returns scores for all categories", () => {
      const result = classifyTaskWithScores("Write a Python function");
      expect(result.type).toBe("coding");
      expect(result.scores.coding).toBeGreaterThan(0);
      expect(typeof result.scores.tools).toBe("number");
      expect(typeof result.scores.reasoning).toBe("number");
      expect(typeof result.scores.vision).toBe("number");
      expect(typeof result.scores.general).toBe("number");
    });

    it("shows higher coding score for coding prompts", () => {
      const result = classifyTaskWithScores("Implement a REST API in TypeScript");
      expect(result.scores.coding).toBeGreaterThan(result.scores.reasoning);
      expect(result.scores.coding).toBeGreaterThan(result.scores.vision);
    });

    it("shows higher reasoning score for analysis prompts", () => {
      const result = classifyTaskWithScores("Analyze the tradeoffs and evaluate options");
      expect(result.scores.reasoning).toBeGreaterThan(result.scores.vision);
    });
  });

  describe("classifyComplexity", () => {
    it("classifies empty prompts as trivial", () => {
      expect(classifyComplexity("")).toBe("trivial");
      expect(classifyComplexity("   ")).toBe("trivial");
    });

    it("classifies short single-intent prompts as trivial", () => {
      expect(classifyComplexity("What time is it?")).toBe("trivial");
      expect(classifyComplexity("Summarize this: hello world")).toBe("trivial");
    });

    it("classifies multi-step or constraint-heavy prompts as complex", () => {
      expect(
        classifyComplexity(
          "Plan a migration from v1 to v2. Keep backward compatibility, add tests, and avoid breaking existing behavior.",
        ),
      ).toBe("complex");
      expect(
        classifyComplexity(
          "Design an architecture for a scalable system. Compare options, list tradeoffs, and propose a rollout plan.",
        ),
      ).toBe("complex");
    });

    it("defaults ambiguous medium prompts to moderate", () => {
      expect(classifyComplexity("Help me improve this email draft")).toBe("moderate");
      expect(classifyComplexity("Explain how this works and provide an example")).toBe("moderate");
    });
  });

  describe("convenience functions", () => {
    describe("isCodingTask", () => {
      it("returns true for coding prompts", () => {
        expect(isCodingTask("Write a function in JavaScript")).toBe(true);
        expect(isCodingTask("Debug this code")).toBe(true);
      });

      it("returns false for non-coding prompts", () => {
        expect(isCodingTask("What's the weather?")).toBe(false);
        expect(isCodingTask("Analyze this image")).toBe(false);
      });
    });

    describe("isVisionTask", () => {
      it("returns true for vision prompts", () => {
        expect(isVisionTask("What's in this image?")).toBe(true);
        expect(isVisionTask("Analyze screenshot.png")).toBe(true);
      });

      it("returns false for non-vision prompts", () => {
        expect(isVisionTask("Write some code")).toBe(false);
        expect(isVisionTask("Hello world")).toBe(false);
      });
    });

    describe("isReasoningTask", () => {
      it("returns true for reasoning prompts", () => {
        expect(isReasoningTask("Think through and analyze the pros and cons")).toBe(true);
        expect(isReasoningTask("Compare and evaluate the tradeoffs")).toBe(true);
      });

      it("returns false for non-reasoning prompts", () => {
        expect(isReasoningTask("Write code")).toBe(false);
        expect(isReasoningTask("Look at this image")).toBe(false);
      });
    });
  });
});
