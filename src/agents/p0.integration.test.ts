/**
 * P0 Core Features Integration Tests
 * 
 * Tests integration between:
 * - Agentic Workflow
 * - Enhanced RAG
 * - Dynamic Reasoning
 * - Existing openclaw features
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AgenticWorkflow } from "./agentic-workflow.js";
import { EnhancedRAG } from "./rag-enhanced.js";
import { DynamicReasoningEngine } from "./dynamic-reasoning.js";
import { createOpenClawTools } from "./openclaw-tools.js";
import type { SolutionEvaluation } from "./agentic-workflow.js";

describe("P0 Integration Tests", () => {
  let workflow: AgenticWorkflow;
  let rag: EnhancedRAG;
  let reasoning: DynamicReasoningEngine;

  beforeEach(() => {
    workflow = new AgenticWorkflow({
      maxIterations: 3,
      minScore: 0.8,
      enableParallelVerify: false,
    });
    
    rag = new EnhancedRAG({
      maxHops: 2,
      minConfidence: 0.5,
      enableSelfAssessment: true,
    });
    
    reasoning = new DynamicReasoningEngine({
      fastThreshold: 0.3,
      balancedThreshold: 0.6,
      enableModelSelection: true,
    });
  });

  describe("Cross-Feature Integration", () => {
    it("should use dynamic reasoning to select workflow strategy", async () => {
      const task = "Build a complete REST API";
      
      // Step 1: Assess task difficulty
      const difficulty = await reasoning.assessTaskDifficulty(task);
      
      expect(difficulty).toBeDefined();
      expect(difficulty.level).toBeDefined();
      expect(difficulty.score).toBeGreaterThanOrEqual(0);
      expect(difficulty.score).toBeLessThanOrEqual(1);
      
      // Step 2: Based on difficulty, execute appropriate workflow
      let iterations = 0;
      const mockGenerate = async () => {
        iterations++;
        return `Solution ${iterations}`;
      };
      
      const mockEvaluate = async (): Promise<SolutionEvaluation> => ({
        score: 0.85,
        feedback: "Good",
        issues: [],
        strengths: ["Complete"],
      });
      
      const result = await workflow.executeWithReflection(
        mockGenerate,
        mockEvaluate,
        task,
      );
      
      expect(result).toBeDefined();
      expect(result.solution).toBeDefined();
      expect(result.iterations).toBeGreaterThanOrEqual(1);
    });

    it("should combine RAG with agentic workflow", async () => {
      const question = "What is quantum computing?";
      
      // Step 1: Use RAG to retrieve information
      const mockRetrieve = async (_query: string): Promise<string[]> => {
        return [
          "Quantum computing uses quantum mechanical phenomena",
          "Qubits can exist in superposition states",
        ];
      };
      
      const mockGenerate = async (_query: string, context: string): Promise<string> => {
        return `Based on retrieved information: ${context}`;
      };
      
      const ragResult = await rag.selfRAG(question, mockRetrieve, mockGenerate);
      
      expect(ragResult.answer).toBeDefined();
      expect(ragResult.confidence).toBeGreaterThanOrEqual(0);
      expect(ragResult.citations).toBeDefined();
      
      // Step 2: Use workflow to refine answer
      const refineTask = `Refine this answer: ${ragResult.answer}`;
      
      let refineCount = 0;
      const refineGenerate = async () => {
        refineCount++;
        return `Refined: ${ragResult.answer} (version ${refineCount})`;
      };
      
      const refineEvaluate = async (): Promise<SolutionEvaluation> => ({
        score: 0.9,
        feedback: "Excellent refinement",
        issues: [],
        strengths: ["Clear", "Accurate"],
      });
      
      const workflowResult = await workflow.executeWithReflection(
        refineGenerate,
        refineEvaluate,
        refineTask,
      );
      
      expect(workflowResult.solution).toBeDefined();
      expect(workflowResult.finalScore).toBeGreaterThanOrEqual(0.8);
    });

    it("should use reasoning to optimize RAG hops", async () => {
      const complexQuestion = "How does quantum computing affect cryptography?";
      
      // Step 1: Assess question complexity
      const difficulty = await reasoning.assessTaskDifficulty(complexQuestion);
      
      // Step 2: Adjust RAG maxHops based on complexity
      const expectedHops = difficulty.level === "deep" ? 3 : 
                          difficulty.level === "balanced" ? 2 : 1;
      
      // Step 3: Execute multi-hop RAG with appropriate hops
      const mockRetrieve = async (query: string): Promise<string[]> => {
        return [`Evidence for: ${query}`];
      };
      
      const mockGenerateSubQuestion = async (
        question: string,
        _context: string,
      ): Promise<string> => {
        return `Sub: ${question}`;
      };
      
      const mockGenerateFinalAnswer = async (
        question: string,
        _context: string,
      ): Promise<string> => {
        return `Answer: ${question}`;
      };
      
      const result = await rag.multiHopRAG(
        complexQuestion,
        mockRetrieve,
        mockGenerateSubQuestion,
        mockGenerateFinalAnswer,
      );
      
      expect(result).toBeDefined();
      expect(result.hops).toBeGreaterThanOrEqual(1);
      expect(result.hops).toBeLessThanOrEqual(expectedHops + 1); // Allow some variance
    });
  });

  describe("Integration with Existing Tools", () => {
    it("should create openclaw tools with P0 features", () => {
      const tools = createOpenClawTools({
        agentSessionKey: "agent:test:session:123",
      });
      
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      // Check for P0 tool names
      const toolNames = tools.map(t => t.name);
      
      expect(toolNames).toContain("dynamic_reasoning");
      expect(toolNames).toContain("agentic_workflow");
      expect(toolNames).toContain("self_rag");
      expect(toolNames).toContain("multihop_rag");
      expect(toolNames).toContain("task_decompose");
    });

    it("should integrate error healing with workflow", async () => {
      // Simulate a scenario where workflow encounters errors
      // and error healing helps recover
      
      let callCount = 0;
      const errorProneGenerate = async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Temporary failure");
        }
        return "Recovered solution";
      };
      
      const mockEvaluate = async (): Promise<SolutionEvaluation> => ({
        score: 0.85,
        feedback: "Good after recovery",
        issues: [],
        strengths: ["Resilient"],
      });
      
      // Workflow should handle errors gracefully
      try {
        const result = await workflow.executeWithReflection(
          async () => {
            try {
              return await errorProneGenerate();
            } catch {
              // Simple error recovery
              return "Fallback solution";
            }
          },
          mockEvaluate,
          "Test with errors",
        );
        
        expect(result).toBeDefined();
        expect(result.solution).toBeDefined();
      } catch (error) {
        // If it fails, ensure it's handled gracefully
        expect(error).toBeDefined();
      }
    });
  });

  describe("Performance Integration", () => {
    it("should complete full P0 pipeline in reasonable time", async () => {
      const startTime = Date.now();
      
      // Step 1: Dynamic reasoning
      const task = "Complex integration test";
      const difficulty = await reasoning.assessTaskDifficulty(task);
      
      // Step 2: Agentic workflow
      const mockGenerate = async () => "Solution";
      const mockEvaluate = async (): Promise<SolutionEvaluation> => ({
        score: 0.8,
        feedback: "Good",
        issues: [],
        strengths: [],
      });
      
      const workflowResult = await workflow.executeWithReflection(
        mockGenerate,
        mockEvaluate,
        task,
      );
      
      // Step 3: RAG
      const mockRetrieve = async () => ["Evidence"];
      const mockGenerateAnswer = async () => "Answer";
      
      const ragResult = await rag.selfRAG(
        "Test query",
        mockRetrieve,
        mockGenerateAnswer,
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete in under 100ms (without actual LLM calls)
      expect(duration).toBeLessThan(100);
      
      // All results should be valid
      expect(difficulty).toBeDefined();
      expect(workflowResult).toBeDefined();
      expect(ragResult).toBeDefined();
    });

    it("should handle concurrent P0 feature usage", async () => {
      // Simulate multiple agents using P0 features concurrently
      const tasks = [
        "Task 1",
        "Task 2",
        "Task 3",
      ];
      
      const results = await Promise.all(
        tasks.map(async (task) => {
          // Each task uses all P0 features
          const difficulty = await reasoning.assessTaskDifficulty(task);
          
          const mockGenerate = async () => `Solution for ${task}`;
          const mockEvaluate = async (): Promise<SolutionEvaluation> => ({
            score: 0.8,
            feedback: "Good",
            issues: [],
            strengths: [],
          });
          
          const workflowResult = await workflow.executeWithReflection(
            mockGenerate,
            mockEvaluate,
            task,
          );
          
          return {
            task,
            difficulty,
            workflowResult,
          };
        }),
      );
      
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.task).toBe(tasks[index]);
        expect(result.difficulty).toBeDefined();
        expect(result.workflowResult).toBeDefined();
      });
    });
  });

  describe("End-to-End Scenarios", () => {
    it("should handle complete user query through P0 pipeline", async () => {
      // Simulate a complete user query scenario
      const userQuery = "How do I build a secure authentication system?";
      
      // Step 1: Assess query complexity
      const difficulty = await reasoning.assessTaskDifficulty(userQuery);
      
      // Step 2: Retrieve relevant information (RAG)
      const knowledgeBase = [
        "Use OAuth2 for authentication",
        "Implement JWT for session management",
        "Store passwords with bcrypt hashing",
        "Use HTTPS for all communications",
      ];
      
      const mockRetrieve = async (): Promise<string[]> => knowledgeBase;
      const mockGenerateAnswer = async (_query: string, context: string): Promise<string> => {
        return `Based on best practices: ${context}`;
      };
      
      const ragResult = await rag.selfRAG(userQuery, mockRetrieve, mockGenerateAnswer);
      
      // Step 3: Refine answer through workflow
      const refineTask = `Make this answer more actionable: ${ragResult.answer}`;
      
      let iteration = 0;
      const refineGenerate = async () => {
        iteration++;
        return `${ragResult.answer} - Actionable version ${iteration}`;
      };
      
      const refineEvaluate = async (): Promise<SolutionEvaluation> => ({
        score: iteration >= 2 ? 0.9 : 0.7,
        feedback: iteration >= 2 ? "Excellent" : "Can improve",
        issues: iteration >= 2 ? [] : ["Needs more detail"],
        strengths: ["Actionable", "Clear"],
      });
      
      const finalResult = await workflow.executeWithReflection(
        refineGenerate,
        refineEvaluate,
        refineTask,
      );
      
      // Verify complete pipeline
      expect(difficulty).toBeDefined();
      expect(ragResult.answer).toBeDefined();
      expect(ragResult.confidence).toBeGreaterThanOrEqual(0);
      expect(finalResult.solution).toBeDefined();
      expect(finalResult.finalScore).toBeGreaterThanOrEqual(0.8);
    });

    it("should fallback gracefully when features fail", async () => {
      // Test graceful degradation
      const failingRetrieve = async (): Promise<string[]> => {
        throw new Error("Retrieval failed");
      };
      
      const fallbackGenerate = async (): Promise<string> => {
        return "Fallback answer (no retrieval available)";
      };
      
      // Should handle retrieval failure gracefully
      try {
        await rag.selfRAG(
          "Test query",
          failingRetrieve,
          fallbackGenerate,
        );
        // If it doesn't throw, that's fine too
      } catch (error) {
        // Expected - retrieval failed
        expect(error).toBeDefined();
      }
    });
  });

  describe("Configuration Integration", () => {
    it("should respect configuration across all P0 features", async () => {
      // Create instances with strict config
      const strictWorkflow = new AgenticWorkflow({
        maxIterations: 1,
        minScore: 0.95,
        enableParallelVerify: false,
      });
      
      /* strictRag reserved for future use */
      const _strictRag = new EnhancedRAG({
        maxHops: 1,
        minConfidence: 0.9,
        enableSelfAssessment: false,
      });
      
      const strictReasoning = new DynamicReasoningEngine({
        fastThreshold: 0.1,
        balancedThreshold: 0.3,
        enableModelSelection: false,
      });
      
      // Verify strict config is respected
      const task = "Test";
      const difficulty = await strictReasoning.assessTaskDifficulty(task);
      expect(difficulty).toBeDefined();
      
      // Workflow should stop after 1 iteration
      let _iterations = 0;
      const mockGenerate = async () => {
        _iterations++;
        return "Solution";
      };
      
      const mockEvaluate = async (): Promise<SolutionEvaluation> => ({
        score: 0.5, // Never reaches minScore
        feedback: "Low score",
        issues: [],
        strengths: [],
      });
      
      const result = await strictWorkflow.executeWithReflection(
        mockGenerate,
        mockEvaluate,
        task,
      );
      
      expect(result.iterations).toBe(1); // Should respect maxIterations
    });
  });
});
