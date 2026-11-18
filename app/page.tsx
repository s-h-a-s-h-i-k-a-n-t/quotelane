import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { findSession, sessionCookieName, sessionId, sessionKey } from "@/lib/server/form-sessions";
import { isSearchBot, readVariant } from "@/lib/server/variants";
import QuoteForm from "./quote-form";
import { QuoteLayout } from "./quote-layout";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <QuoteLayout>
      <Suspense fallback={<p role="status">Loading the quote form…</p>}>
        <SessionForm searchParams={searchParams} />
      </Suspense>
    </QuoteLayout>
  );
}

async function SessionForm({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const [params, cookieStore, requestHeaders] = await Promise.all([searchParams, cookies(), headers()]);
  if (isSearchBot(requestHeaders.get("user-agent"))) {
    return <QuoteForm variant="a" prefill={{}} sessionKey="" />;
  }

  const override = typeof params.variant === "string" ? readVariant(params.variant) : undefined;
  const id = sessionId(cookieStore.get(sessionCookieName(override))?.value);
  const session = await findSession(id).catch(() => null);

  if (session === null) {
    return <p role="alert">The quote form is temporarily unavailable. Please try again.</p>;
  }
  if (!session || session.submitted) {
    redirect(override ? `/?variant=${override}&restart=1` : "/?restart=1");
  }

  const key = sessionKey(session.id);
  return <QuoteForm key={key} variant={session.variant} prefill={session.prefill} sessionKey={key} override={override} />;
}
