import { describe, expect, it } from "vitest";
import {
  generateTraceId,
  generateSpanId,
  parseTraceparent,
  formatTraceparent,
  createTraceContext,
  getCurrentTraceContext,
  getCurrentTraceId,
  getShortTraceId,
  withTraceContext,
  withTraceContextAsync,
  extractOrCreateTraceContext,
  createOutgoingTraceparent,
  traceLogMeta,
} from "./trace-context.js";

describe("trace-context", () => {
  describe("generateTraceId", () => {
    it("generates a 32 character hex string", () => {
      const traceId = generateTraceId();
      expect(traceId).toMatch(/^[a-f0-9]{32}$/);
    });

    it("generates unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateTraceId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe("generateSpanId", () => {
    it("generates a 16 character hex string", () => {
      const spanId = generateSpanId();
      expect(spanId).toMatch(/^[a-f0-9]{16}$/);
    });

    it("generates unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateSpanId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe("parseTraceparent", () => {
    it("parses a valid traceparent header", () => {
      const header = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
      const ctx = parseTraceparent(header);
      expect(ctx).toEqual({
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
        spanId: "00f067aa0ba902b7",
        sampled: true,
        parentSpanId: "00f067aa0ba902b7",
      });
    });

    it("handles unsampled traces", () => {
      const header = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00";
      const ctx = parseTraceparent(header);
      expect(ctx?.sampled).toBe(false);
    });

    it("returns null for undefined input", () => {
      expect(parseTraceparent(undefined)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseTraceparent("")).toBeNull();
    });

    it("returns null for invalid format", () => {
      expect(parseTraceparent("invalid")).toBeNull();
      expect(parseTraceparent("00-invalid")).toBeNull();
      expect(
        parseTraceparent("01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"),
      ).toBeNull();
    });

    it("returns null for all-zero trace ID", () => {
      expect(
        parseTraceparent("00-00000000000000000000000000000000-00f067aa0ba902b7-01"),
      ).toBeNull();
    });

    it("returns null for all-zero span ID", () => {
      expect(
        parseTraceparent("00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01"),
      ).toBeNull();
    });

    it("normalizes to lowercase", () => {
      const header = "00-4BF92F3577B34DA6A3CE929D0E0E4736-00F067AA0BA902B7-01";
      const ctx = parseTraceparent(header);
      expect(ctx?.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    });
  });

  describe("formatTraceparent", () => {
    it("formats a trace context as a traceparent header", () => {
      const ctx = {
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
        spanId: "00f067aa0ba902b7",
        sampled: true,
      };
      expect(formatTraceparent(ctx)).toBe(
        "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      );
    });

    it("formats unsampled traces correctly", () => {
      const ctx = {
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
        spanId: "00f067aa0ba902b7",
        sampled: false,
      };
      expect(formatTraceparent(ctx)).toBe(
        "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
      );
    });
  });

  describe("createTraceContext", () => {
    it("creates a new trace context without parent", () => {
      const ctx = createTraceContext();
      expect(ctx.traceId).toMatch(/^[a-f0-9]{32}$/);
      expect(ctx.spanId).toMatch(/^[a-f0-9]{16}$/);
      expect(ctx.sampled).toBe(true);
      expect(ctx.parentSpanId).toBeUndefined();
    });

    it("creates a child span from parent", () => {
      const parent = createTraceContext();
      const child = createTraceContext(parent);

      expect(child.traceId).toBe(parent.traceId);
      expect(child.spanId).not.toBe(parent.spanId);
      expect(child.sampled).toBe(parent.sampled);
      expect(child.parentSpanId).toBe(parent.spanId);
    });
  });

  describe("AsyncLocalStorage", () => {
    it("returns null when not in a traced context", () => {
      expect(getCurrentTraceContext()).toBeNull();
      expect(getCurrentTraceId()).toBe("no-trace");
      expect(getShortTraceId()).toBe("no-trace");
    });

    it("withTraceContext provides context synchronously", () => {
      const ctx = createTraceContext();
      const result = withTraceContext(ctx, () => {
        const current = getCurrentTraceContext();
        expect(current).toEqual(ctx);
        return getCurrentTraceId();
      });
      expect(result).toBe(ctx.traceId);
    });

    it("withTraceContextAsync provides context asynchronously", async () => {
      const ctx = createTraceContext();
      const result = await withTraceContextAsync(ctx, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        const current = getCurrentTraceContext();
        expect(current).toEqual(ctx);
        return getCurrentTraceId();
      });
      expect(result).toBe(ctx.traceId);
    });

    it("getShortTraceId returns first 8 chars", () => {
      const ctx = createTraceContext();
      withTraceContext(ctx, () => {
        expect(getShortTraceId()).toBe(ctx.traceId.slice(0, 8));
      });
    });
  });

  describe("extractOrCreateTraceContext", () => {
    it("creates new context when no traceparent header", () => {
      const ctx = extractOrCreateTraceContext({});
      expect(ctx.traceId).toMatch(/^[a-f0-9]{32}$/);
      expect(ctx.parentSpanId).toBeUndefined();
    });

    it("extracts context from valid traceparent header", () => {
      const ctx = extractOrCreateTraceContext({
        traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      });
      expect(ctx.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
      expect(ctx.parentSpanId).toBe("00f067aa0ba902b7");
      expect(ctx.spanId).not.toBe("00f067aa0ba902b7"); // New span created
    });

    it("creates new context for invalid traceparent header", () => {
      const ctx = extractOrCreateTraceContext({
        traceparent: "invalid",
      });
      expect(ctx.traceId).toMatch(/^[a-f0-9]{32}$/);
      expect(ctx.parentSpanId).toBeUndefined();
    });
  });

  describe("createOutgoingTraceparent", () => {
    it("creates new trace when not in context", () => {
      const header = createOutgoingTraceparent();
      expect(header).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);
    });

    it("creates child span when in context", () => {
      const ctx = createTraceContext();
      withTraceContext(ctx, () => {
        const header = createOutgoingTraceparent();
        expect(header).toContain(ctx.traceId);
        expect(header).not.toContain(ctx.spanId);
      });
    });
  });

  describe("traceLogMeta", () => {
    it("returns empty object when not in context", () => {
      expect(traceLogMeta()).toEqual({});
    });

    it("returns trace metadata when in context", () => {
      const parent = createTraceContext();
      const child = createTraceContext(parent);
      withTraceContext(child, () => {
        const meta = traceLogMeta();
        expect(meta.traceId).toBe(child.traceId);
        expect(meta.spanId).toBe(child.spanId);
        expect(meta.parentSpanId).toBe(parent.spanId);
      });
    });
  });
});
