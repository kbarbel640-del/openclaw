/**
 * Sophie's Image Tools
 *
 * Extends Sophie's tools with image-aware capabilities:
 * - Show flagged images inline in chat
 * - Capture and display Lightroom screenshots
 * - Before/after comparison views
 */

import fs from "node:fs";
import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../src/agents/tools/common.js";
import { jsonResult, imageResultFromFile } from "../../../src/agents/tools/common.js";

export function createSophieImageTools(): AnyAgentTool[] {
  return [createShowImageTool(), createCompareImagesTool()];
}

function createShowImageTool(): AnyAgentTool {
  return {
    name: "sophie_show_image",
    description:
      "Display an image inline in the chat. Use this to show the photographer " +
      "a specific photo — for flagging, review, or to explain an editing decision.",
    parameters: Type.Object({
      path: Type.String({
        description: "Absolute path to the image file",
      }),
      label: Type.Optional(
        Type.String({
          description: "Caption or label for the image",
        }),
      ),
      context: Type.Optional(
        Type.String({
          description: "Why Sophie is showing this image (flag, review, example, etc.)",
        }),
      ),
    }),
    async execute(_id, params: Record<string, unknown>) {
      const imgPath = params.path as string;
      const label = (params.label as string) ?? imgPath.split("/").pop() ?? "image";
      const context = params.context as string | undefined;

      if (!fs.existsSync(imgPath)) {
        return jsonResult({
          error: `File not found: ${imgPath}`,
        });
      }

      const extraText = context ? `${label}\n\n${context}` : label;

      return await imageResultFromFile({
        label,
        path: imgPath,
        extraText,
        details: {
          source: "sophie",
          context: context ?? "review",
        },
      });
    },
  };
}

function createCompareImagesTool(): AnyAgentTool {
  return {
    name: "sophie_compare_images",
    description:
      "Show two images side by side for comparison. Use this for before/after " +
      "editing comparisons or to compare two candidate images from a duplicate group.",
    parameters: Type.Object({
      image_a: Type.String({
        description: "Path to the first image (e.g. 'before' or 'option A')",
      }),
      image_b: Type.String({
        description: "Path to the second image (e.g. 'after' or 'option B')",
      }),
      label_a: Type.Optional(Type.String({ description: "Label for image A" })),
      label_b: Type.Optional(Type.String({ description: "Label for image B" })),
    }),
    async execute(_id, params: Record<string, unknown>) {
      const pathA = params.image_a as string;
      const pathB = params.image_b as string;
      const labelA = (params.label_a as string) ?? "A";
      const labelB = (params.label_b as string) ?? "B";

      const missing: string[] = [];
      if (!fs.existsSync(pathA)) missing.push(pathA);
      if (!fs.existsSync(pathB)) missing.push(pathB);

      if (missing.length > 0) {
        return jsonResult({
          error: `Files not found: ${missing.join(", ")}`,
        });
      }

      const result = await imageResultFromFile({
        label: `${labelA} vs ${labelB}`,
        path: pathA,
        extraText: `Comparing: ${labelA} (shown) vs ${labelB}`,
        details: {
          source: "sophie",
          context: "comparison",
          imageA: pathA,
          imageB: pathB,
          labelA,
          labelB,
        },
      });

      return result;
    },
  };
}
