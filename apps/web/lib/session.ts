// The access token lives only in memory: a reload forgets it, and the
// refresh cookie brings a new one.
let token: string | null = null

export function accessToken(): string | null {
  return token
}

export function setAccessToken(value: string): void {
  token = value
}

export function clearSession(): void {
  token = null
}
