import * as React from "react"
import { cn } from "@/lib/utils"

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "ghost"

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  destructive: "bg-destructive/10 text-destructive",
  outline: "border border-border text-foreground",
  ghost: "hover:bg-muted hover:text-muted-foreground",
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex h-5 w-fit items-center justify-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
export type { BadgeVariant }
