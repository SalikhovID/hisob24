import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

// SheetForm is a form inside a sheet: it fills the sheet's body, so its
// footer (the main button) stands at the bottom however short the form,
// and its blocks keep their height.
export function SheetForm({ className, ...props }: ComponentProps<"form">) {
  return <form noValidate data-slot="sheet-form" className={cn("flex flex-1 flex-col [&>*]:shrink-0", className)} {...props} />
}
