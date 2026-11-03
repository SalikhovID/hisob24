"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "cn"

// Switch is the prototype's switch: on a phone the iOS one (51×31, its
// track green when on), on the web a small one (32×18, its track the
// accent when on); a white thumb slides right. On Base UI's switch: a
// button with role switch, labeled by a label beside it.
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative h-[31px] w-[51px] shrink-0 rounded-full bg-ink-5 transition-colors duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40 data-checked:bg-switch-on md:h-[18px] md:w-8",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="block size-[27px] translate-x-0.5 rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,.15),0_3px_1px_rgba(0,0,0,.06)] transition-transform duration-200 ease-[cubic-bezier(.45,0,.1,1)] data-checked:translate-x-[22px] md:size-[14px] md:shadow-[0_1px_2px_rgba(0,0,0,.2)] md:data-checked:translate-x-4"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
