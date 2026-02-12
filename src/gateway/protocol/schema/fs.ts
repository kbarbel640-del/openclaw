import { Type } from "@sinclair/typebox";

export const FsPickDirectoryParamsSchema = Type.Object(
  {
    prompt: Type.Optional(Type.String()),
    defaultDir: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
