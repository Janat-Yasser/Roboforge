import { NextResponse, type NextRequest } from "next/server";

/** Cheap gate for pages: redirect to /login without a session cookie. APIs authenticate themselves. */
export function middleware(req: NextRequest) {
  if (!req.cookies.get("rf_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/projects/:path*"] };
