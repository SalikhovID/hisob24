import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// The buttons are the prototype's: 32px, 8px round, 13px medium; the
// accent filled, a secondary one white with a hairline ring, a ghost grey
// until the pointer comes, a deletion soft red. A large one is the
// prototype's full button: 50px and 17px semibold on a phone, 40px on the
// web. An icon button is its 30px square, a round one its 36px circle.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent bg-clip-padding text-[13px] font-medium whitespace-nowrap transition-[transform,background-color,color] duration-150 ease-out-expo outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:scale-[.98] disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_88%,#000)]",
        outline: "bg-card text-accent-text shadow-[var(--card-shadow),0_0_0_1px_var(--ink-4)] hover:bg-ink-1",
        secondary: "bg-card text-foreground shadow-[var(--card-shadow),0_0_0_1px_var(--ink-4)] hover:bg-ink-1 [&_svg]:text-icon",
        ghost: "text-muted-foreground hover:bg-ink-1 hover:text-foreground",
        destructive: "bg-destructive-soft text-destructive hover:bg-[color-mix(in_srgb,var(--destructive)_16%,transparent)]",
        link: "text-accent-text underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3",
        xs: "h-6 px-2 text-[12px]",
        sm: "h-7 px-2.5",
        lg: "h-[50px] rounded-xl px-4 text-[17px] font-semibold md:h-10 md:rounded-md md:px-3 md:text-[13px] md:font-medium",
        mini: "h-8 rounded-md px-3 text-accent-text",
        round: "size-9 rounded-full p-0 [&_svg:not([class*='size-'])]:size-5",
        icon: "size-[30px] rounded-md",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-md",
        "icon-lg": "size-9 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
