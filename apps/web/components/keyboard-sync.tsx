"use client"

import { useEffect } from "react"
import { isEditable, keyboardInset, revealDelta, scrollerOf } from "@/lib/keyboard"
import { useMiniApp } from "@/lib/telegram"

// How long the page waits, after the last word of the screen's size or of the
// focus, before it settles: the keyboard slides over many frames, and focus
// moving from one field to the next leaves the keyboard up.
const QUIET = 100

// KeyboardSync keeps the page clear of the phone's soft keyboard. While a
// field is typed in, it tells the page how much of its bottom the keyboard
// lies over (--keyboard-inset on <html>, which the room under a page and under
// a sheet reads, globals.css), takes that back when the keyboard goes, and,
// once the keyboard has settled, scrolls the field out from under it. The
// browser's word that the screen resized, and Telegram's that the Mini App's
// viewport changed, both start it. A field that is only focused, with no
// keyboard over the page and the screen not resized, is the browser's own to
// bring into view.
export function KeyboardSync() {
  const miniApp = useMiniApp()
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const root = document.documentElement
    let timer: number | undefined
    // changed: the screen resized since the page last settled.
    let changed = false
    // publish says how much of the page's bottom the keyboard lies over and
    // returns it.
    const publish = () => {
      const hidden = isEditable(document.activeElement) ? keyboardInset(viewport, window.innerHeight) : 0
      if (hidden > 0) root.style.setProperty("--keyboard-inset", `${hidden}px`)
      else root.style.removeProperty("--keyboard-inset")
      return hidden
    }
    const reveal = () => {
      const field = document.activeElement
      if (!isEditable(field) || viewport.scale > 1.01) return
      const delta = revealDelta(field.getBoundingClientRect(), { top: viewport.offsetTop, bottom: viewport.offsetTop + viewport.height })
      if (delta !== 0) scrollerOf(field).scrollBy({ top: delta, behavior: "smooth" })
    }
    const settle = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (publish() > 0 || changed) reveal()
        changed = false
      }, QUIET)
    }
    const resized = () => {
      changed = true
      publish()
      settle()
    }
    viewport.addEventListener("resize", resized)
    miniApp?.onEvent("viewportChanged", resized)
    document.addEventListener("focusin", settle)
    document.addEventListener("focusout", settle)
    return () => {
      window.clearTimeout(timer)
      viewport.removeEventListener("resize", resized)
      miniApp?.offEvent("viewportChanged", resized)
      document.removeEventListener("focusin", settle)
      document.removeEventListener("focusout", settle)
      root.style.removeProperty("--keyboard-inset")
    }
  }, [miniApp])
  return null
}
