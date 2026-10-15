export { cn } from "cn"

// norm is text for matching: lowercase, the apostrophes of o' and g' and
// the tutuq dropped, so "o'zbek", "oʻzbek" and "ozbek" meet.
export const norm = (text: string) => text.toLowerCase().replace(/['ʻʼ’`]/g, "")
