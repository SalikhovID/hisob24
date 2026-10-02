"use client"

// OtpLogin is the browser login: the code the admin bot sends after /login.
export function OtpLogin({ botUsername }: { botUsername: string }) {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Hisob24 Admin</h1>
          <p className="text-sm text-muted-foreground">
            Kodni olish uchun botga <code className="rounded bg-muted px-1 py-0.5 font-mono">/login</code> yozing
          </p>
          {botUsername && (
            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              @{botUsername}
            </a>
          )}
        </div>
      </div>
    </main>
  )
}
