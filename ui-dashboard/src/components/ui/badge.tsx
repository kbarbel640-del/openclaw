import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-accent text-white shadow",
        secondary:
          "border-transparent bg-bg-secondary text-text-primary",
        destructive:
          "border-transparent bg-error text-white shadow",
        outline: "text-text-primary border-border",
        success:
          "border-transparent bg-success text-white shadow",
        warning:
          "border-transparent bg-warning text-white shadow",
        error:
          "border-transparent bg-error text-white shadow",
        purple:
          "border-transparent bg-purple text-white shadow",
        muted:
          "border-transparent bg-bg-tertiary text-text-secondary",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-1.5 py-0 text-[10px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// Legacy type alias for backward compatibility
type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants>

function Badge({
  className,
  variant,
  size,
  ...props
}: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
export type { BadgeProps }
