import * as React from "react"
import { cn } from "@/lib/utils"

const Dialog = React.forwardRef(({ className, ...props }, ref) => (
  <dialog ref={ref} className={cn("dialog", className)} {...props} />
))
Dialog.displayName = "Dialog"

export { Dialog }
