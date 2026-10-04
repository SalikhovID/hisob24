import { Loader2Icon } from "lucide-react"
import type { ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// PendingButton is a button whose request may be on its way: while it is,
// the button cannot be pressed again, says it is busy and shows a spinner
// before its name, which stays as it was. It stays where the keyboard left
// it: a button the browser disables cannot hold focus, and whoever pressed
// Enter on it would be dropped back to the top of the page. So while it
// waits it is off for presses only (aria-disabled), and plainly disabled
// only for a reason of its own.
export function PendingButton({
  pending,
  disabled,
  className,
  children,
  ...props
}: ComponentProps<typeof Button> & { pending: boolean }) {
  return (
    <Button
      disabled={pending || disabled}
      focusableWhenDisabled={pending}
      aria-busy={pending || undefined}
      className={cn("aria-disabled:pointer-events-none aria-disabled:opacity-50", className)}
      {...props}
    >
      {pending && <Loader2Icon className="animate-spin motion-reduce:animate-none" />}
      {children}
    </Button>
  )
}
