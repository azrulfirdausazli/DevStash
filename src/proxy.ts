import NextAuth from "next-auth";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

export const proxy = auth((req) => {
  const isDashboard = req.nextUrl.pathname.startsWith("/dashboard");
  const isProfile = req.nextUrl.pathname === "/profile";
  if ((isDashboard || isProfile) && !req.auth) {
    const signInUrl = new URL("/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return Response.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/profile"],
};
