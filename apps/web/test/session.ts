import { api, call } from "@/lib/api"
import { setAccessToken } from "@/lib/session"
import { LOGIN_CODE } from "@/mocks/data"

// signIn logs phone in through the mocked API the way the login page does:
// a code, then the access token kept in memory.
export async function signIn(phone: string) {
  await call(api.POST("/app/auth/sms/send", { body: { phone } }))
  const tokens = await call(api.POST("/app/auth/sms/verify", { body: { phone, code: LOGIN_CODE } }))
  setAccessToken(tokens.access_token)
  return tokens
}
