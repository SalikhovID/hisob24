"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckIcon, InfoIcon, TriangleAlertIcon, XIcon, Loader2Icon } from "lucide-react"

// The toasts are the prototype's: a glass pill in the middle of the top of
// the screen with a green (or red) round icon and the message in one line.
// sonner's own padding and width are stronger than a class: they are
// overridden (!), and the pill is centered over its full-width slot.
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      className="toaster group"
      icons={{
        success: <CheckIcon className="size-[13px]" strokeWidth={3.2} />,
        info: <InfoIcon className="size-[13px]" strokeWidth={3} />,
        warning: <TriangleAlertIcon className="size-[13px]" strokeWidth={3} />,
        error: <XIcon className="size-[13px]" strokeWidth={3.2} />,
        loading: <Loader2Icon className="size-[13px] animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--menu)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "transparent",
          "--border-radius": "22px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "cn-toast right-0! left-0! mx-auto! w-fit! max-w-[calc(100vw-32px)] items-center gap-2! py-2.5! pr-4! pl-3! text-md! font-semibold! shadow-float! ring-[0.5px] ring-glass-edge ring-inset backdrop-blur-[24px] backdrop-saturate-[1.8]",
          icon: "m-0! grid size-[22px] place-items-center rounded-full bg-positive text-white [&_svg]:size-[13px]",
          error: "[&_[data-icon]]:bg-destructive",
          warning: "[&_[data-icon]]:bg-warning",
          info: "[&_[data-icon]]:bg-primary",
          description: "text-sm font-normal text-muted-foreground",
        },
      }}
      containerAriaLabel="Bildirishnomalar"
      // The distances from the edge (20px on a wide screen, as the
      // prototype's web view; 16px on a phone), plus what Telegram lays over
      // the top of a full-screen Mini App (--safe-top, 0 anywhere else).
      offset={{ top: "calc(20px + var(--safe-top))" }}
      mobileOffset={{ top: "calc(16px + var(--safe-top))" }}
      {...props}
    />
  )
}

export { Toaster }
