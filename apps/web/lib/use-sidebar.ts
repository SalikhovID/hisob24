import { useCallback, useState, useSyncExternalStore } from "react"

const KEY = "sidebar_collapsed"
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another tab folding the sidebar folds it here too.
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

// A browser may refuse its storage (a locked-down WebView): the sidebar then
// simply stays unfolded.
function stored(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "true"
  } catch {
    return false
  }
}

function store(collapsed: boolean) {
  try {
    window.localStorage.setItem(KEY, String(collapsed))
  } catch {
    // Nowhere to keep the choice.
  }
  listeners.forEach((listener) => listener())
}

// useSidebar is the sidebar's state. open: the sections are out as a sheet
// (a phone). collapsed: the sidebar is folded to icons (a wide screen); the
// choice is kept in the browser, so the next visit opens the same way. The
// server's HTML is always unfolded.
export function useSidebar() {
  const [open, setOpen] = useState(false)
  const collapsed = useSyncExternalStore(subscribe, stored, () => false)
  const toggleCollapsed = useCallback(() => store(!stored()), [])
  return { open, setOpen, collapsed, toggleCollapsed }
}
