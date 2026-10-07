// iconAction styles an action in a list's row: an icon button that keeps a
// 44px target under a thumb (the crud-ui design, ActionTooltip).
export const iconAction =
  "text-muted-foreground hover:text-foreground max-md:relative max-md:size-9 max-md:after:absolute max-md:after:-inset-1 pointer-coarse:relative pointer-coarse:size-9 pointer-coarse:after:absolute pointer-coarse:after:-inset-1"

// nounOf is what a record is called: a product or a service.
export const nounOf = (kind: "product" | "service") => (kind === "service" ? "Xizmat" : "Mahsulot")
