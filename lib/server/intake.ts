import { initialAnswers, type Answers, type Field, type Variant } from "@/lib/form-steps";
import { acceptsPrefill, normalizePhone, readText } from "@/lib/validation";

const prefillParams = {
  zip: "zip",
  first_name: "firstName",
  last_name: "lastName",
  email: "email",
  phone: "phone",
  year: "year",
  insured: "insured",
} as const satisfies Record<string, Field>;

function readParam(params: URLSearchParams, key: string): string {
  const values = params.getAll(key);
  if (values.length !== 1) return "";
  const value = readText(values[0], 254);
  return /[{}\[\]]|%%/.test(value) ? "" : value;
}

export function readAttribution(params: URLSearchParams) {
  const trackingId = (key: string) => {
    const value = readParam(params, key);
    return /^[a-z0-9][a-z0-9._~-]{0,127}$/i.test(value) ? value : null;
  };
  const channel = readParam(params, "channel").toLowerCase();

  return {
    click_id: trackingId("click_id"),
    aff_id: trackingId("aff_id"),
    channel: /^[a-z][a-z0-9_-]{0,39}$/.test(channel) ? channel : null,
  };
}

export function readPrefill(params: URLSearchParams, variant: Variant) {
  const prefill: Partial<Answers> = {};
  for (const [parameter, field] of Object.entries(prefillParams)) {
    if (variant === "b" && field === "year") continue;
    let value = readParam(params, parameter);
    if (!value) continue;
    if (field === "insured") value = value.toLowerCase();
    if (!acceptsPrefill(field, { ...initialAnswers, [field]: value })) continue;
    if (field === "phone") value = normalizePhone(value) ?? "";
    prefill[field] = value;
  }
  return prefill;
}
