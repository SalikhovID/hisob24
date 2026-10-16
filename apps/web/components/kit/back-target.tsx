"use client"

import { createContext, type ReactNode, useContext, useEffect, useState } from "react"

// BackTarget is a page's way back: where it leads and what it is called
// (the page's BackLink).
export interface BackTarget {
  href: string
  label: string
}

type SetTarget = (change: (current: BackTarget | null) => BackTarget | null) => void

const TargetContext = createContext<BackTarget | null>(null)
const SetContext = createContext<SetTarget | null>(null)

// BackTargetProvider lets the shell know the way back of the page it holds:
// on a wide screen the top bar's «Orqaga» leads there (the page's own link
// is a phone's).
export function BackTargetProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<BackTarget | null>(null)
  return (
    <SetContext value={setTarget}>
      <TargetContext value={target}>{children}</TargetContext>
    </SetContext>
  )
}

// useBackTarget is the way back of the page the shell holds; null on a
// section's own page, which leads nowhere back.
export function useBackTarget(): BackTarget | null {
  return useContext(TargetContext)
}

// useRegisterBack tells the shell a page's way back while the page shows
// it. Leaving, it takes back its own alone: the next page may have told
// its already.
export function useRegisterBack({ href, label }: BackTarget) {
  const setTarget = useContext(SetContext)
  useEffect(() => {
    if (!setTarget) return
    setTarget(() => ({ href, label }))
    return () => setTarget((current) => (current?.href === href && current.label === label ? null : current))
  }, [setTarget, href, label])
}
