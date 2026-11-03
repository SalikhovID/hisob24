"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckIcon, InfoIcon, TriangleAlertIcon, XIcon, Loader2Icon } from "lucide-react"

// The toasts are the prototype's: at the bottom of the screen (on a phone
// over the floating tab bar, on the web 24px up), the ink's pill with the
// page's color in it (a capsule of 15px words on a phone, a 10px round one
// of 13px on the web), a small green (or red) icon before the message.
// sonner's own padding and width are stronger than a class: they are
// overridden (!), and the pill is centered over its full-width slot.
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="bottom-center"
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
          "--normal-bg": "var(--foreground)",
          "--normal-text": "var(--card)",
          "--normal-border": "transparent",
          "--border-radius": "999px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "cn-toast right-0! left-0! mx-auto! w-fit! max-w-[calc(100vw-32px)] items-center gap-2! py-2.5! pr-4! pl-3! text-[15px]! font-medium! shadow-float! md:rounded-lg! md:py-2! md:pr-3.5! md:pl-2.5! md:text-[13px]!",
          icon: "m-0! grid size-[18px] place-items-center rounded-full bg-positive text-white [&_svg]:size-[11px]",
          error: "[&_[data-icon]]:bg-destructive",
          warning: "[&_[data-icon]]:bg-warning",
          info: "[&_[data-icon]]:bg-primary",
          description: "text-sm font-normal text-muted-foreground",
        },
      }}
      containerAriaLabel="Bildirishnomalar"
      // The distances from the bottom: 24px on the web; on a phone over the
      // floating tab bar, plus the phone's bottom edge (and Telegram's).
      offset={{ bottom: "24px" }}
      mobileOffset={{ bottom: "calc(108px + max(env(safe-area-inset-bottom), var(--tg-safe-area-inset-bottom, 0px)))" }}
      {...props}
    />
  )
}

export { Toaster }
