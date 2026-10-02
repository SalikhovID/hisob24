import type { Metadata } from "next"
import { connection } from "next/server"
import { LoginScreen } from "@/components/login/login-screen"

export const metadata: Metadata = { title: "Kirish — Hisob24 Admin" }

// The bot's username is read per request, so one build serves any
// deployment.
export default async function LoginPage() {
  await connection()
  return <LoginScreen botUsername={process.env.ADMIN_BOT_USERNAME ?? ""} />
}
