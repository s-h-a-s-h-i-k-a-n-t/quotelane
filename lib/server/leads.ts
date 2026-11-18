import { consentText } from "@/lib/consent";
import type { Answers } from "@/lib/form-steps";
import { normalizePhone } from "@/lib/validation";
import { getDatabase } from "./db";
import type { FormSession } from "./form-sessions";

const maxAttempts = 10;

export async function allowLeadAttempt(ip: string): Promise<boolean> {
  const result = await getDatabase().query(
    `INSERT INTO lead_rate_limits (ip, window_start, attempts)
     VALUES ($1, date_trunc('minute', statement_timestamp()), 1)
     ON CONFLICT (ip) DO UPDATE
     SET window_start = GREATEST(lead_rate_limits.window_start, EXCLUDED.window_start),
         attempts = CASE WHEN lead_rate_limits.window_start < EXCLUDED.window_start
                         THEN 1 ELSE lead_rate_limits.attempts + 1 END
     WHERE lead_rate_limits.window_start < EXCLUDED.window_start
        OR lead_rate_limits.attempts < $2
     RETURNING attempts`,
    [ip, maxAttempts],
  );
  return result.rowCount === 1;
}

type ConsentRequest = {
  submittedAt: Date;
  ip: string;
  userAgent: string;
  pageUrl: string;
};

export async function saveLead(answers: Answers, session: FormSession, request: ConsentRequest) {
  const email = answers.email.toLowerCase();
  const phone = normalizePhone(answers.phone);
  if (!phone) throw new Error("Lead phone must be validated before saving.");

  const client = await getDatabase().connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
    const { rows: [current] } = await client.query<{ submitted: boolean }>(
      "SELECT submitted FROM form_sessions WHERE id = $1 AND expires_at > now() FOR UPDATE",
      [session.id],
    );
    if (!current || current.submitted) {
      await client.query("ROLLBACK");
      return current ? "duplicate" : "expired";
    }

    // Use the same lock order in every transaction, then check with a fresh snapshot.
    await client.query(
      `SELECT pg_advisory_xact_lock(lock_id)
         FROM (SELECT DISTINCT hashtextextended(key, 0) AS lock_id
                 FROM unnest($1::text[]) AS key ORDER BY lock_id) AS locks`,
      [[`email:${email}`, `phone:${phone}`]],
    );
    const duplicate = await client.query(
      `SELECT 1 FROM leads
         WHERE created_at >= clock_timestamp() - interval '24 hours'
           AND (email = $1 OR phone = $2)
         LIMIT 1`,
      [email, phone],
    );
    if (duplicate.rowCount) {
      await client.query("ROLLBACK");
      return "duplicate";
    }

    const { rows: [lead] } = await client.query<{ id: string }>(
      `INSERT INTO leads (
         variant, zip, insured, vehicle_year, vehicle_make, age_range,
         first_name, last_name, email, phone, click_id, aff_id, channel, prefilled_fields
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
        session.variant, answers.zip, answers.insured === "yes",
        session.variant === "a" ? Number(answers.year) : null,
        session.variant === "a" ? answers.make : null,
        session.variant === "a" ? answers.ageRange : null,
        answers.firstName, answers.lastName, email, phone,
        session.click_id, session.aff_id, session.channel, Object.keys(session.prefill),
      ],
    );
    await client.query(
      `INSERT INTO lead_consents (lead_id, consent_text, submitted_at, request_ip, user_agent, page_url)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [lead.id, consentText, request.submittedAt, request.ip, request.userAgent, request.pageUrl],
    );
    await client.query(
      `UPDATE form_sessions
       SET submitted = true, prefill = '{}', click_id = NULL, aff_id = NULL, channel = NULL
       WHERE id = $1`,
      [session.id],
    );
    await client.query("COMMIT");
    return "saved";
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
