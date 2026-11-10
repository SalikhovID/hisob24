"use client"

import { useEffect } from "react"
import { isEditable, keyboardInset } from "@/lib/keyboard"

// KeyboardSync keeps the page clear of the phone's soft keyboard. While a
// field is typed in, it tells the page how much of its bottom the keyboard
// lies over (--keyboard-inset on <html>, which the room under a page and under
// a sheet reads, globals.css), and takes that back when the keyboard goes.
export function KeyboardSync() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const root = document.documentElement
    const publish = () => {
      const hidden = isEditable(document.activeElement) ? keyboardInset(viewport, window.innerHeight) : 0
      if (hidden > 0) root.style.setProperty("--keyboard-inset", `${hidden}px`)
      else root.style.removeProperty("--keyboard-inset")
    }
    viewport.addEventListener("resize", publish)
    return () => {
      viewport.removeEventListener("resize", publish)
      root.style.removeProperty("--keyboard-inset")
    }
  }, [])
  return null
}
