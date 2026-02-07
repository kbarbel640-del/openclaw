/**
 * TypeBox schemas for all Data-Service connector tool parameters.
 *
 * Note: org_id and user_id are NOT exposed as tool parameters.
 * They MUST be set via data-service.setContext gateway method.
 */

import { Type } from "@sinclair/typebox";

export const ConnectorExecuteSchema = Type.Object({
  connector: Type.String({
    description:
      "The connector type to use (e.g., 'brave_search', 'google_calendar', 'hubspot', 'slack'). Use connector_list to see available connectors.",
  }),
  action: Type.String({
    description:
      "The action to execute on the connector (e.g., 'search' for brave_search, 'create' for calendar events). Use connector_actions to see available actions.",
  }),
  input: Type.String({
    description:
      'JSON string containing the action input parameters. For brave_search: \'{"query": "your search query"}\'. For calendar: \'{"summary": "Meeting", "start_datetime": "...", "end_datetime": "..."}\'.',
  }),
  connector_id: Type.Optional(
    Type.String({
      description:
        "Optional connector instance ID. If not provided, the tool will look up the user's configured connector from Data-Service.",
    }),
  ),
});

export const ConnectorListSchema = Type.Object({
  category: Type.Optional(
    Type.String({
      description:
        "Optional category filter (e.g., 'productivity', 'crm', 'communication', 'search').",
    }),
  ),
});

export const ConnectorActionsSchema = Type.Object({
  connector: Type.String({
    description: "The connector type to get available actions for.",
  }),
});

export const ConnectorSchemaSchema = Type.Object({
  connector: Type.String({
    description: "The connector type (e.g., 'email', 'brave_search', 'tables').",
  }),
  action: Type.String({
    description: "The action name to get schema for (e.g., 'send', 'search', 'create').",
  }),
});

export const ConnectorLookupSchema = Type.Object({
  connector: Type.String({
    description: "The connector type to look up.",
  }),
});

export const UserConnectorsSchema = Type.Object({});

export const CoworkerListSchema = Type.Object({});

export const ConnectorSearchSchema = Type.Object({
  query: Type.String({
    description:
      "Search query to find the right connector (e.g., 'linkedin', 'email', 'search', 'calendar'). Can be connector name or what you want to do.",
  }),
  action: Type.Optional(
    Type.String({
      description:
        "Optional: specific action you want to perform (e.g., 'send_message', 'send', 'search', 'create'). If provided, returns schema for this action.",
    }),
  ),
});
