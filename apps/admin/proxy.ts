import { type NextRequest, NextResponse } from "next/server"

// proxy guards the panel's pages: without the admin_session cookie a page
// sends the browser to /login. The cookie's session is checked by the API on
// every request; an expired one answers 401, which also leads to /login.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("admin_session")) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  return NextResponse.next()
}

export const config = {
  // Every page but /login. The API behind the /api rewrite checks its own
  // sessions, and Next's files and the icons need none: the login page shows
  // them too.
  matcher: ["/((?!login(?:$|/)|api/|_next/static|_next/image|favicon\\.ico|icon\\.svg|apple-icon\\.png).*)"],
}
