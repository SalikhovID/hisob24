import { type NextRequest, NextResponse } from "next/server"

// proxy guards the app's pages: without the refresh_token cookie a page sends
// the browser to /login. The cookie itself is checked by the API on refresh;
// a refused one also ends at /login.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("refresh_token")) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  return NextResponse.next()
}

export const config = {
  // Every page but /login. The API behind the /api rewrite checks its own
  // tokens, and Next's files and the icons need none: the login page shows
  // them too.
  matcher: ["/((?!login(?:$|/)|api/|_next/static|_next/image|favicon\\.ico|icon\\.svg|apple-icon\\.png).*)"],
}
