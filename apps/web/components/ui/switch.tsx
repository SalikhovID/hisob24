"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "cn"

// Switch is the iOS switch of the prototype (51×31, a white thumb that
// slides right and turns the track the accent), on Base UI's switch: a
// button with role switch, labeled by a label beside it.
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative h-[31px] w-[51px] shrink-0 rounded-full bg-[#E3E3E8] transition-colors duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-45 data-checked:bg-primary dark:bg-muted",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="block size-[27px] translate-x-0.5 rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,.15),0_1px_1px_rgba(0,0,0,.08)] transition-transform duration-250 ease-spring data-checked:translate-x-[22px]"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
