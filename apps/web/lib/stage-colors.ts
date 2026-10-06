import type { StageColor } from "./types"

// stageColors are the colors a stage may be shown in, in the order a form
// offers them: the API's StageColor, hues Tailwind has.
export const stageColors: StageColor[] = ["slate", "red", "orange", "amber", "green", "teal", "blue", "violet", "pink"]

// colorLabels are the colors' Uzbek names: what a swatch is called.
export const colorLabels: Record<StageColor, string> = {
  slate: "Kulrang",
  red: "Qizil",
  orange: "To'q sariq",
  amber: "Sariq",
  green: "Yashil",
  teal: "Moviy",
  blue: "Ko'k",
  violet: "Binafsha",
  pink: "Pushti",
}

// colorClasses are the class names a stage's color is shown with: a dot in
// the hue, and a badge of the hue's soft background with readable text in
// light and in dark. They are written out whole: Tailwind only sees class
// names that stand in the source as they are.
export const colorClasses: Record<StageColor, { dot: string; badge: string }> = {
  slate: { dot: "bg-slate-500", badge: "bg-slate-500/10 text-slate-800 dark:text-slate-300" },
  red: { dot: "bg-red-500", badge: "bg-red-500/10 text-red-800 dark:text-red-300" },
  orange: { dot: "bg-orange-500", badge: "bg-orange-500/10 text-orange-800 dark:text-orange-300" },
  amber: { dot: "bg-amber-500", badge: "bg-amber-500/10 text-amber-800 dark:text-amber-300" },
  green: { dot: "bg-green-500", badge: "bg-green-500/10 text-green-800 dark:text-green-300" },
  teal: { dot: "bg-teal-500", badge: "bg-teal-500/10 text-teal-800 dark:text-teal-300" },
  blue: { dot: "bg-blue-500", badge: "bg-blue-500/10 text-blue-800 dark:text-blue-300" },
  violet: { dot: "bg-violet-500", badge: "bg-violet-500/10 text-violet-800 dark:text-violet-300" },
  pink: { dot: "bg-pink-500", badge: "bg-pink-500/10 text-pink-800 dark:text-pink-300" },
}
