import { NextResponse, type NextRequest } from "next/server";

function configuredShareToken() {
  const token = process.env.SHARE_TOKEN || "";
  if (token) return token;
  if (process.env.VERCEL || process.env.RENDER) return "";
  return "dev-share";
}

export function proxy(request: NextRequest) {
  const shareToken = request.nextUrl.pathname.split("/")[2] || "";
  const expectedToken = configuredShareToken();

  if (!expectedToken || shareToken !== expectedToken) {
    return new NextResponse("Not found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/s/:path*",
};
