import { Type } from "@sinclair/typebox";

export const ProjectsListParamsSchema = Type.Object(
  {
    search: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Integer({ minimum: 1 })),
    rootDir: Type.Optional(Type.String()),
    includeHidden: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);
