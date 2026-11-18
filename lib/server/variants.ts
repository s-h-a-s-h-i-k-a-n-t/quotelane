import { randomInt } from "node:crypto";
import type { Variant } from "@/lib/form-steps";

export const assignmentCookie = "ql_assignment";

export function readVariant(value: string | null | undefined): Variant | undefined {
  if (value === "a" || value === "b") return value;
}

export function isSearchBot(userAgent: string | null): boolean {
  return /googlebot|google-inspectiontool|bingbot|bingpreview|duckduckbot|yandexbot|baiduspider|sogou|slurp|applebot/i.test(userAgent ?? "");
}

export function selectVariant(saved: Variant | undefined, configured: string | undefined) {
  const parsed = configured?.trim() ? Number(configured) : NaN;
  const percent = Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : 50;
  if (percent === 0) return { variant: "a" as const };
  if (percent === 100) return { variant: "b" as const };
  if (saved) return { variant: saved };

  const variant: Variant = randomInt(10000) < percent * 100 ? "b" : "a";
  return { variant, assignment: variant };
}
