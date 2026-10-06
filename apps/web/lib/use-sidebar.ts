import { useCallback, useSyncExternalStore } from "react"

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

// useSidebar is the sidebar's state: collapsed, the sidebar is folded to
// icons (a wide screen); the choice is kept in the browser, so the next
// visit opens the same way. The server's HTML is always unfolded. A phone
// has no sidebar to fold: its sections are the tab bar's.
export function useSidebar() {
  const collapsed = useSyncExternalStore(subscribe, stored, () => false)
  const toggleCollapsed = useCallback(() => store(!stored()), [])
  return { collapsed, toggleCollapsed }
}
