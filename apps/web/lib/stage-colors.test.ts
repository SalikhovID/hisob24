import { expect, test } from "vitest"
import { colorClasses, colorLabels, stageColors } from "./stage-colors"

test("the nine colors a stage may have, each with its Uzbek name, in the order a form offers them", () => {
  expect(stageColors.map((color) => [color, colorLabels[color]])).toEqual([
    ["slate", "Kulrang"],
    ["red", "Qizil"],
    ["orange", "To'q sariq"],
    ["amber", "Sariq"],
    ["green", "Yashil"],
    ["teal", "Moviy"],
    ["blue", "Ko'k"],
    ["violet", "Binafsha"],
    ["pink", "Pushti"],
  ])
})

test("every color has a dot and a badge in its own hue, as whole class names Tailwind can see", () => {
  expect(stageColors).toHaveLength(9)
  expect(Object.keys(colorClasses)).toEqual(stageColors)
  for (const color of stageColors) {
    expect(colorClasses[color].dot, color).toBe(`bg-${color}-500`)
    expect(colorClasses[color].badge, color).toContain(`bg-${color}-500/10`)
    expect(colorClasses[color].badge, color).toContain(`text-${color}-800`)
    expect(colorClasses[color].badge, color).toContain(`dark:text-${color}-300`)
  }
})
