    dns: z.array(z.string()).optional(),
    extraHosts: z.array(z.string()).optional(),
    binds: z.array(z.string()).optional(),
    runtime: z.string().trim().min(1).optional(),
    dangerouslyAllowReservedContainerTargets: z.boolean().optional(),
    dangerouslyAllowExternalBindSources: z.boolean().optional(),
  })
  .strict()