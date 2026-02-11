/**
 * TypeBox schemas for Wexa-Service tool parameters.
 */

import { Type } from "@sinclair/typebox";

// ============================================================================
// Process Flow Tool Schemas
// ============================================================================

export const ProcessflowListSchema = Type.Object({
  project_id: Type.String({
    description:
      "The project ID of the agent whose process flows you want to list. Get this from the 'Your Available Agents' table in your context.",
  }),
});

export const ProcessflowExecuteSchema = Type.Object({
  project_id: Type.String({
    description:
      "The project ID of the agent. Get this from the 'Your Available Agents' table in your context.",
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
