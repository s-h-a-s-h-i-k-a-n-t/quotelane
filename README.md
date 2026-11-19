# QuoteLane

QuoteLane is a mobile-first auto insurance lead funnel. The Next.js app captures affiliate attribution, offers two form lengths, and saves each accepted lead and its consent record in PostgreSQL.

## Live demo

- [Open QuoteLane](https://quotelane-omega.vercel.app/) to try the regular A/B assignment.
- [Open version A](https://quotelane-omega.vercel.app/?variant=a) to try the full six-step form.
- [Open version B](https://quotelane-omega.vercel.app/?variant=b) to try the short three-step form.
- [Open version B with Sam Lee’s test details](https://quotelane-omega.vercel.app/?variant=b&click_id=demo123&aff_id=42&channel=email&zip=90210&insured=yes&first_name=Sam&last_name=Lee&email=sam%40example.com&phone=%2B14145550123). Expect to land on Step 3 of 3 with the contact fields filled in. Refresh to check that prefill survives, or use **Back** to inspect the skipped answers.

To test lead capture, use a synthetic email and US phone number that the demo has not used in the past 24 hours. Click **Get My Quotes** and confirm that the thank-you page opens. In the browser’s Network tab, `POST /api/leads` should return HTTP `201`.

## Run locally

1. Install dependencies with `npm ci`.
2. Create a Git-ignored `.env.local` alongside `package.json`. Set `DATABASE_URL` to the PostgreSQL connection string and optionally set `SPLIT_PERCENT_B` (default `50`). Keep the connection string server-side.
3. On a fresh database, run the SQL in `migrations/001_create_leads_and_consents.sql` and then `migrations/002_create_sessions_and_rate_limits.sql` using the Neon SQL editor or `psql`. Run each migration once per database. If migration 001 is already applied, run only 002.
4. Run `npm run dev` and open the local URL printed by Next.js. Use localhost for local lead submissions. Run `npm run lint` and `npm run build` to check the project.

For Vercel, import the repository and set `DATABASE_URL` and `SPLIT_PERCENT_B` for the deployment environment. Apply both migrations to that environment's database before testing. Use a separate database or branch for preview deployments if they accept test leads.

## Test the funnel

- Open [Variant A](http://localhost:3000/?variant=a) and [Variant B](http://localhost:3000/?variant=b). Check mobile layout, progress, invalid answers, Back, and the exact consent text above Get My Quotes. A asks six steps and B asks three.
- Open [a prefilled B visit](http://localhost:3000/?variant=b&click_id=demo123&aff_id=42&channel=SMS&zip=%2090210%20&insured=YES&first_name=Sam&last_name=Lee&email=sam%40example.com&phone=%2B1%20415%20555%200123). Expect a redirect to `/?variant=b` and a prefilled contact screen. Refresh to confirm prefill survives, then use Back to edit skipped answers. For A, add `year=2020` and switch the variant to A. Expect to start at vehicle make.
- Try `/?variant=a&zip=1234&year=%7Bsub5%7D&first_name=%5BEMAIL%5D&email=notanemail&phone=abc`. Expect the ZIP step first. The remaining invalid answers stay blank.
- Submit synthetic details and check the thank-you page. Change the name before submitting to verify the lead stores the final name with the prefill field name. In Neon, inspect the latest rows using the query below.
- Start a fresh form and reuse either email or phone within 24 hours, varying the other value. Expect a duplicate error. Try alternative formatting or case for the matched value. A different email and number allow another test lead. Two overlapping requests with matching contact details can create one lead.
- Send three POST attempts from the same IP in a fresh clock minute. Expect HTTP 429 on the third attempt. A malformed JSON submission counts toward this limit.
- At a split between 0 and 100, visit without a variant query, refresh, and reopen in the same browser to check the assignment. Force the other variant with a test link, then open the bare URL again to check the original assignment. With the user agent set to Googlebot, even `?variant=b` resolves to A.

```sql
SELECT l.id, l.created_at, l.variant, l.click_id, l.aff_id, l.channel,
       l.prefilled_fields, c.lead_id IS NOT NULL AS consent_saved
FROM leads AS l
LEFT JOIN lead_consents AS c ON c.lead_id = l.id
ORDER BY l.created_at DESC
LIMIT 5;
```

## Design decisions

- Proxy selects the variant on the landing route. A short-lived, random session cookie identifies a PostgreSQL row with the validated prefill, attribution, and variant. The form uses the server-selected variant. Its fingerprint binds the submission to the session that rendered the form, so an old tab cannot silently submit against a newer session.
- The intake trims whitespace, normalizes insurance status and channel case, uses decoded query parameters, and ignores duplicate keys, macros, and invalid values. Form inputs can always be edited using Back. Valid prefilled steps are skipped on the way forward. Contact is always shown so the visitor can review their details and consent. A still asks for make and age range because the brief does not list them as URL-prefill fields.
- The server redirects before rendering any page from a link carrying prefill or tracking data. The redirect drops the input parameters, keeps a valid test variant when present, and sends a no-referrer policy. Titles are static, the app has no analytics or third-party frontend requests, session responses are private, Next.js development request logging is disabled, and application errors omit raw URLs and payloads. The original URL reaches the CDN before app code runs. Verify that hosting, proxy, and log drains omit query strings before accepting real prefill traffic.
- The lead keeps final answers and the names of fields initially prefilled, including ones edited before submission. The session scrubs its original prefill and attribution when the lead is saved. Unsubmitted sessions expire after 30 minutes and new visits remove expired rows. Edits live in browser memory until submission and a refresh restores the original prefill.
- The server validates the selected form, normalizes contact details, and saves the lead and consent in one transaction. PostgreSQL locks on both normalized identities serialize competing inserts before the rolling duplicate check. IP and user agent come from request headers in production. Localhost uses the loopback IP. A PostgreSQL counter applies a fixed one-minute rate limit across instances.
- Before real traffic, schedule session and rate-limit cleanup, verify URL logging controls and retention across infrastructure, add operational monitoring, review consent and retention with the business, and finish partner delivery with durable retries and receiver-supported idempotency.

## Attribution questions

**a. What is a click ID?** A click ID identifies a particular inbound click. Carrying it to the lead lets us join a downstream conversion to the originating click and affiliate.

**b. How does a sale postback credit the affiliate?** QuoteLane sends the partner its click ID with the lead. After a sale, the partner calls our authenticated conversion endpoint with the click ID and a unique conversion ID. We deduplicate the conversion, match it to our click record, and credit the lead's affiliate. If the affiliate needs a callback, we send it their original click ID and the conversion details they expect.

**c. Postback vs. pixel.** A server-to-server postback sends a conversion directly between servers, which works for sales that happen later or offline. A pixel runs in the browser and can report page events where the browser has the relevant context. Browser privacy settings and blockers can limit pixel delivery.

**d. Missing test conversion.** First confirm the advertiser fired the expected event and sent it to the correct environment. Check the actual request method, URL, credentials, parameter names, and status code. Then verify the click ID exists, the conversion ID wasn't already used, and reporting filters, time zones, or processing delays aren't hiding it. Check tracker-side logs and retry only after understanding whether the original was accepted.

**e. Why store both click IDs?** Our ID is the key for our own attribution records. The affiliate's ID belongs to its tracking system and might only be unique within that affiliate. Keeping both lets us match internally and send the affiliate the exact ID it recognizes.

## Judgment calls

**f. Kill switch vs. sticky.** At 0%, regular traffic gets A. At 100%, it gets B. Existing sticky cookies are preserved and take effect again at intermediate percentages. In between, only unassigned browsers are randomized. This gives operations an immediate way to remove a broken form, at the cost of changing what some returning visitors see while an extreme is active. Recognized search bots get A.

**g. Testing B in production.** Open `/?variant=b` with synthetic details. The test URL chooses a separate, expiring preview session and leaves the normal assignment cookie untouched. Close the preview or reopen the bare URL to return to normal traffic rules. The flag is a QA convenience, so keep test links out of affiliate campaigns.

**h. SMS with missing config.** Let the visitor complete the funnel and save `channel=sms`. Capture does not depend on a channel-specific partner setting. When delivery is added, use a configured default route when allowed, or hold the lead for review. Report SMS separately using the stored channel.

**i. Two brands, one partner.** Store a brand identifier in our own records and associate it with the click and lead. For the partner, agree on a distinct account, campaign, or endpoint that preserves the brand in their reporting. If the existing contract allows an opaque identifier, agree on a brand-aware ID and keep a mapping. If every value and route must be identical, their data has no signal to distinguish the brands and the integration contract needs to change.
