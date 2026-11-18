import { createHash, randomUUID } from "node:crypto";
import type { Answers, Variant } from "@/lib/form-steps";
import { getDatabase } from "./db";
import { readAttribution, readPrefill } from "./intake";

export const sessionMaxAge = 30 * 60;

export type FormSession = {
  id: string;
  variant: Variant;
  prefill: Partial<Answers>;
  click_id: string | null;
  aff_id: string | null;
  channel: string | null;
  submitted: boolean;
};

export function sessionCookieName(override: Variant | undefined): string {
  return override ? `ql_preview_${override}` : "ql_session";
}

export function sessionId(value: string | undefined): string | undefined {
  if (value && /^[ab]:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value)) {
    return value.slice(2);
  }
}

export function sessionKey(id: string): string {
  return createHash("sha256").update(id).digest("hex");
}

export async function findSession(id: string | undefined): Promise<FormSession | undefined> {
  if (!id) return;
  const result = await getDatabase().query<FormSession>(
    "SELECT id, variant, prefill, click_id, aff_id, channel, submitted FROM form_sessions WHERE id = $1 AND expires_at > now()",
    [id],
  );
  return result.rows[0];
}

export async function createSession(variant: Variant, params: URLSearchParams): Promise<string> {
  const id = randomUUID();
  const { click_id, aff_id, channel } = readAttribution(params);
  await getDatabase().query(
    `WITH expired AS (
       DELETE FROM form_sessions WHERE expires_at <= now()
     )
     INSERT INTO form_sessions (id, variant, prefill, click_id, aff_id, channel)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, variant, JSON.stringify(readPrefill(params, variant)), click_id, aff_id, channel],
  );
  return `${variant}:${id}`;
}
