// maskAmount shows what is typed, pasted or set in a money field as a
// number is read: its thousands apart by a space, its decimals after a
// comma. The digits stay; the first dot or comma is the comma (the digits
// after a second one go on as decimals); anything else goes. No zeros stand
// in front of the whole part, but a lone one does, and a comma with no
// whole part before it is given one.
export function maskAmount(text: string): string {
  let whole = ""
  let decimals: string | null = null
  for (const char of text) {
    if (char >= "0" && char <= "9") {
      if (decimals === null) whole += char
      else decimals += char
    } else if ((char === "," || char === ".") && decimals === null) {
      decimals = ""
    }
  }
  whole = whole.replace(/^0+(?=\d)/, "")
  if (whole === "" && decimals !== null) whole = "0"
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return decimals === null ? grouped : `${grouped},${decimals}`
}
