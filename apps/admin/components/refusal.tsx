import { CircleAlertIcon } from "lucide-react"
import type { ReactNode } from "react"
import { FieldError } from "@/components/ui/field"

// Refusal is the API's reason for turning a form down (a phone that is in
// the company already): it stands between the fields and the buttons, with
// an icon that tells it from a field's own message.
export function Refusal({ children }: { children: ReactNode }) {
  return (
    <FieldError className="flex items-start gap-2">
      <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {children}
    </FieldError>
  )
}
