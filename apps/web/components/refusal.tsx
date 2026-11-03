import { CircleAlertIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

// Refusal is the API's reason for turning a form down (a phone that is in
// the company already), a flat soft red card with an icon,
// between the fields and the button, and under the reason what can be done
// about it (actions: buttons such as "Mijozni ochish"). The reason is the
// alert's own text: the pages (and their tests) find it by that.
export function Refusal({ children, actions, className }: { children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div data-slot="refusal" className={cn("flex gap-2.5 rounded-group bg-destructive-soft px-3.5 py-3 text-md leading-snug text-destructive md:rounded-lg md:text-[13px]", className)}>
      <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div role="alert">{children}</div>
        {actions && (
          <div className="mt-1.5 flex flex-wrap gap-3.5 [&_a]:text-accent-text [&_button]:min-h-8 [&_button]:text-md [&_button]:font-medium [&_button]:text-accent-text">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
