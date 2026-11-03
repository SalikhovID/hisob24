import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// The prototype's badge: a pill (24px, 13px on a phone; 20px, 11.5px medium
// on the web), neutral the ink on a faint fill, a tone a soft tint with the
// hue's own text; a dot (a stage's color) may lead. The names from before
// (default, secondary, destructive, outline) stay for the pages not yet
// moved over.
const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-[5px] rounded-badge px-2.5 text-[13px] font-medium whitespace-nowrap tabular-nums md:h-5 md:px-2 md:text-[11.5px] [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        neutral: "bg-ink-2 text-foreground",
        accent: "bg-primary-soft text-accent-text",
        red: "bg-destructive-soft text-destructive",
        green: "bg-positive-soft text-positive",
        warn: "bg-warning-soft text-warning",
        default: "bg-primary-soft text-accent-text",
        secondary: "bg-ink-2 text-foreground",
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
  dotColor,
  render,
  children,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { dot?: boolean; dotColor?: string }) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
        children: (
          <>
            {dot && (
              <span
                aria-hidden="true"
                data-slot="badge-dot"
                className="size-1.5 shrink-0 rounded-full bg-current"
                style={dotColor ? { background: dotColor } : undefined}
              />
            )}
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
