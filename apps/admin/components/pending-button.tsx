import { Loader2Icon } from "lucide-react"
import type { ComponentProps } from "react"
import { Button } from "@/components/ui/button"

// PendingButton is a button whose request may be on its way: while it is,
// the button cannot be pressed again, says it is busy and shows a spinner
// before its name, which stays as it was.
export function PendingButton({
  pending,
  disabled,
  children,
  ...props
}: ComponentProps<typeof Button> & { pending: boolean }) {
  return (
    <Button disabled={pending || disabled} aria-busy={pending || undefined} {...props}>
      {pending && <Loader2Icon className="animate-spin motion-reduce:animate-none" />}
      {children}
    </Button>
  )
}
