import { NextRequest, NextResponse } from "next/server";
import { createSession, sessionCookieName, sessionId, sessionMaxAge } from "@/lib/server/form-sessions";
import { assignmentCookie, isSearchBot, readVariant, selectVariant } from "@/lib/server/variants";

export const config = { matcher: "/" };

export async function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const forcedValues = url.searchParams.getAll("variant");
  const bot = isSearchBot(request.headers.get("user-agent"));
  const override = !bot && forcedValues.length === 1 ? readVariant(forcedValues[0]) : undefined;
  const cleanUrl = url.clone();
  cleanUrl.search = "";
  if (override) cleanUrl.searchParams.set("variant", override);

  const visibleParams = new URLSearchParams(url.searchParams);
  visibleParams.delete("_rsc");
  const needsRedirect = visibleParams.toString() !== cleanUrl.searchParams.toString();

  if (bot) {
    const response = needsRedirect ? NextResponse.redirect(cleanUrl, 302) : NextResponse.next();
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const decision = override
    ? { variant: override, assignment: undefined }
    : selectVariant(readVariant(request.cookies.get(assignmentCookie)?.value), process.env.SPLIT_PERCENT_B);
  const cookieName = sessionCookieName(override);
  const current = request.cookies.get(cookieName)?.value;

  let cookieValue: string | undefined;
  if (needsRedirect || !sessionId(current) || !current?.startsWith(decision.variant + ":")) {
    try {
      cookieValue = await createSession(decision.variant, visibleParams);
      request.cookies.set(cookieName, cookieValue);
    } catch {
      console.error("QuoteLane could not start a form session.");
      if (!needsRedirect) {
        return new NextResponse("The quote form is temporarily unavailable. Please try again.", {
          status: 503,
          headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
        });
      }
    }
  }

  const response = needsRedirect
    ? NextResponse.redirect(cleanUrl, 302)
    : NextResponse.next({ request: { headers: request.headers } });

  const cookieOptions = {
    httpOnly: true,
    secure: Boolean(process.env.VERCEL) || url.protocol === "https:",
    sameSite: "lax" as const,
    path: "/",
  };

  if (cookieValue) response.cookies.set(cookieName, cookieValue, { ...cookieOptions, maxAge: sessionMaxAge });
  if (decision.assignment) {
    response.cookies.set(assignmentCookie, decision.assignment, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 });
  }
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
