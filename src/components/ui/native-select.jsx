import * as React from "react"
import { cn } from "@/lib/utils"

const NativeSelect = React.forwardRef(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn("flex min-h-11 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50", className)}
    {...props}
  >
    {children}
  </select>
))
NativeSelect.displayName = "NativeSelect"

export { NativeSelect }
