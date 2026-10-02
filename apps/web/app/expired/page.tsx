import type { Metadata } from "next"
import { Expired } from "@/components/expired"

export const metadata: Metadata = { title: "Obuna tugagan — Hisob24" }

export default function ExpiredPage() {
  return <Expired />
}
