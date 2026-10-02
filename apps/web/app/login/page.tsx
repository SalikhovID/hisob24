import type { Metadata } from "next"
import { LoginScreen } from "@/components/login/login-screen"

export const metadata: Metadata = { title: "Kirish — Hisob24" }

export default function LoginPage() {
  return <LoginScreen />
}
