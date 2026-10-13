import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-main border border-transparent bg-clip-padding text-md font-semibold whitespace-nowrap transition-[transform,background-color,color] duration-150 ease-out-expo outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:scale-[.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground active:opacity-90",
        outline: "bg-card text-primary ring-[0.5px] ring-border ring-inset active:bg-press",
        secondary: "bg-muted text-foreground active:bg-press",
        ghost: "text-primary active:bg-muted",
        destructive: "bg-destructive text-white active:opacity-90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5",
        xs: "h-7 rounded-full px-2.5 text-xs",
        sm: "h-8 rounded-full px-3 text-sm",
        lg: "h-11 px-4 text-base",
        mini: "h-[34px] rounded-full bg-muted px-3 text-sm",
        round: "size-11 rounded-full p-0 [&_svg:not([class*='size-'])]:size-[22px]",
        icon: "size-9",
        "icon-xs": "size-7 rounded-full [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-full",
        "icon-lg": "size-11",
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
