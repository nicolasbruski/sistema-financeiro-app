import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef(({ className, ...props }, ref) => (
  <section ref={ref} className={cn("rounded-lg border border-border bg-card text-card-foreground", className)} {...props} />
))
Card.displayName = "Card"

export { Card }
