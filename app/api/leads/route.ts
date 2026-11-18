import { isIP } from "node:net";
import type { NextRequest } from "next/server";
import { stepsByVariant, type Answers } from "@/lib/form-steps";
import { findSession, sessionCookieName, sessionId, sessionKey } from "@/lib/server/form-sessions";
import { allowLeadAttempt, saveLead } from "@/lib/server/leads";
import { readVariant } from "@/lib/server/variants";
import { readText, validateStep } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const submittedAt = new Date();
  const url = request.nextUrl;
  const isLocal = !process.env.VERCEL && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const ip = isLocal ? "127.0.0.1" : process.env.VERCEL ? request.headers.get("x-vercel-forwarded-for") : null;
  if (!ip || !isIP(ip)) {
    return Response.json({ error: "Could not verify the request IP." }, { status: 400 });
  }

  try {
    if (!(await allowLeadAttempt(ip))) {
      return Response.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": "60" } });
    }
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return Response.json({ error: "Send quote answers as JSON." }, { status: 415 });
    }

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Send the quote answers as a JSON object." }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const override = readVariant(url.searchParams.get("variant"));
    const id = sessionId(request.cookies.get(sessionCookieName(override))?.value);
    const session = await findSession(id);
    if (!session || input.sessionKey !== sessionKey(session.id)) {
      return Response.json({ error: "This form session ended." }, { status: 410 });
    }
    if (session.submitted) {
      return Response.json({ error: "This form was already submitted." }, { status: 409 });
    }

    const answers: Answers = {
      zip: readText(input.zip, 5),
      year: typeof input.year === "number" ? String(input.year) : "",
      make: readText(input.make, 100),
      insured: typeof input.insured === "boolean" ? (input.insured ? "yes" : "no") : "",
      ageRange: readText(input.ageRange, 16),
      firstName: readText(input.firstName, 100),
      lastName: readText(input.lastName, 100),
      email: readText(input.email, 254),
      phone: readText(input.phone, 40),
    };
    const fields = Object.assign({}, ...stepsByVariant[session.variant].map((step) => validateStep(step, answers)));
    if (Object.keys(fields).length) {
      return Response.json({ error: "Check your quote answers.", fields }, { status: 400 });
    }

    const pageUrl = new URL("/", url);
    if (override) pageUrl.searchParams.set("variant", override);
    const result = await saveLead(answers, session, {
      submittedAt,
      ip,
      userAgent: request.headers.get("user-agent") ?? "",
      pageUrl: pageUrl.toString(),
    });
    if (result === "expired") return Response.json({ error: "This form session ended." }, { status: 410 });
    if (result === "duplicate") return Response.json({ error: "A matching lead was submitted within 24 hours." }, { status: 409 });

    return Response.json({ ok: true }, { status: 201 });
  } catch {
    console.error("QuoteLane could not process a lead submission.");
    return Response.json({ error: "Could not save your quote request." }, { status: 500 });
  }
}
