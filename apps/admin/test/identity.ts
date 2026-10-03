// identityOf reads an identity as [title, subtitle]. The two share an element
// with the avatar's initials (hidden from assistive technology, but text all
// the same), so the element's own text would not tell them apart.
export const identityOf = (element: Element) =>
  ["identity-title", "identity-subtitle"].map(
    (slot) => element.querySelector(`[data-slot="${slot}"]`)?.textContent ?? null,
  )
