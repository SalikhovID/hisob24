import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// The prototype's badge: 22px tall, 7px corners, a soft tint with the hue's
// own text. The names from before (default, secondary, destructive, outline)
// stay for the pages not yet moved over.
const badgeVariants = cva(
  "group/badge inline-flex h-[22px] w-fit shrink-0 items-center justify-center gap-1.5 rounded-badge px-2 text-xs font-medium whitespace-nowrap tabular-nums [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        neutral: "bg-muted text-muted-foreground",
        accent: "bg-primary-soft text-primary",
        red: "bg-destructive-soft text-destructive",
        green: "bg-positive-soft text-positive",
        warn: "bg-warning-soft text-warning",
        default: "bg-primary-soft text-primary",
        secondary: "bg-muted text-muted-foreground",
        destructive: "bg-destructive-soft text-destructive",
        outline: "bg-transparent text-muted-foreground ring-1 ring-border ring-inset",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

function Badge({
  className,
  variant = "neutral",
  dot = false,
  render,
  children,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
        children: (
          <>
            {dot && <span aria-hidden="true" data-slot="badge-dot" className="size-2 shrink-0 rounded-full bg-current" />}
            {children}
          </>
        ),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
