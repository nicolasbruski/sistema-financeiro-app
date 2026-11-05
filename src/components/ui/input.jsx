import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn("flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", className)}
    {...props}
  />
))
Input.displayName = "Input"

export { Input }
