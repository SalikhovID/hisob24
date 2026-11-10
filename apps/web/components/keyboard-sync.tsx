"use client"

import { useEffect } from "react"
import { isEditable, keyboardInset } from "@/lib/keyboard"

// How long after the field lost focus the page lets go of the keyboard's
// room: focus moving from one field to the next leaves the keyboard up.
const LET_GO = 100

// KeyboardSync keeps the page clear of the phone's soft keyboard. While a
// field is typed in, it tells the page how much of its bottom the keyboard
// lies over (--keyboard-inset on <html>, which the room under a page and under
// a sheet reads, globals.css), and takes that back when the keyboard goes.
export function KeyboardSync() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const root = document.documentElement
    let timer: number | undefined
    const publish = () => {
      const hidden = isEditable(document.activeElement) ? keyboardInset(viewport, window.innerHeight) : 0
      if (hidden > 0) root.style.setProperty("--keyboard-inset", `${hidden}px`)
      else root.style.removeProperty("--keyboard-inset")
    }
    const later = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(publish, LET_GO)
    }
    viewport.addEventListener("resize", publish)
    document.addEventListener("focusout", later)
    return () => {
      window.clearTimeout(timer)
      viewport.removeEventListener("resize", publish)
      document.removeEventListener("focusout", later)
      root.style.removeProperty("--keyboard-inset")
    }
  }, [])
  return null
}
