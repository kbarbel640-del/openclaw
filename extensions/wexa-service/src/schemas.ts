/**
 * TypeBox schemas for Wexa-Service tool parameters.
 */

import { Type } from "@sinclair/typebox";

// ============================================================================
// Coworker Tool Schemas
// ============================================================================

export const CoworkerListSchema = Type.Object({});

// ============================================================================
// Process Flow Tool Schemas
// ============================================================================

export const ProcessflowListSchema = Type.Object({
  project_id: Type.String({
    description:
      "The project ID of the coworker whose process flows you want to list. Get this from coworker_list.",
  }),
});

export const ProcessflowExecuteSchema = Type.Object({
  project_id: Type.String({
    description: "The project ID of the coworker. Get this from coworker_list.",
  }),
  agentflow_id: Type.String({
    description: "The process flow (agentflow) ID to execute. Get this from processflow_list.",
  }),
  goal: Type.Optional(
    Type.String({
      description:
        "The goal description for this execution. If not provided, the goal template from processflow_list will be used.",
    }),
  ),
  input_variables: Type.Optional(
    Type.String({
      description:
        'JSON string of input variables matching the flow\'s input_schema from processflow_list. Example: \'{"company_name": "Acme Corp", "industry": "tech"}\'.',
    }),
  ),
});

export const ProcessflowStatusSchema = Type.Object({
  execution_id: Type.String({
    description: "The execution ID returned by processflow_execute to check status for.",
  }),
});
