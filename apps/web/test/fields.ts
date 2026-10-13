import { within } from "@testing-library/react"

// fieldsOf reads a type's list of fields (the prototype's rows) as each
// field's name, kind and marks.
export const fieldsOf = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((item) => {
      const row = item.firstElementChild as HTMLElement
      return {
        label: row.querySelector('[data-slot="row-title"] > span')?.textContent,
        kind: row.querySelector('[data-slot="row-sub"]')?.textContent,
        marks: Array.from(row.querySelectorAll('[data-slot="badge"]')).map((mark) => mark.textContent),
      }
    })
