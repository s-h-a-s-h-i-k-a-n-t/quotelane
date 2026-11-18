import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { ageRanges, type Answers, type Field, type Step } from "./form-steps";

export type FieldErrors = Partial<Record<Field, string>>;

const fieldSteps: Record<Field, Step> = {
  zip: "zip",
  year: "year",
  make: "make",
  insured: "insured",
  ageRange: "ageRange",
  firstName: "contact",
  lastName: "contact",
  email: "contact",
  phone: "contact",
};

export function readText(value: unknown, maxLength: number): string {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value)) return "";
  const cleaned = value.trim();
  return cleaned.length <= maxLength ? cleaned : "";
}

export function normalizePhone(value: string): string | undefined {
  const phone = parsePhoneNumberFromString(value, { defaultCountry: "US", extract: false });
  if (phone?.country === "US" && !phone.ext && phone.isValid()) return phone.number;
}

function validEmail(value: string): boolean {
  return /^[^\s@.]+(?:\.[^\s@.]+)*@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(value);
}

function validName(value: string): boolean {
  return /\p{L}/u.test(value) && /^[\p{L}\p{M} .’'\-]+$/u.test(value);
}

export function acceptsPrefill(field: Field, answers: Answers): boolean {
  return !validateStep(fieldSteps[field], answers)[field];
}

export function validateStep(step: Step, answers: Answers): FieldErrors {
  switch (step) {
    case "zip": {
      const zip = readText(answers.zip, 5);
      return /^\d{5}$/.test(zip) && zip !== "00000" ? {} : { zip: "Enter a valid 5-digit ZIP code." };
    }
    case "year": {
      const year = readText(answers.year, 4);
      const latest = new Date().getFullYear() + 1;
      return /^\d{4}$/.test(year) && Number(year) >= 1886 && Number(year) <= latest
        ? {}
        : { year: `Enter a four-digit year from 1886 to ${latest}.` };
    }
    case "make":
      return readText(answers.make, 100) ? {} : { make: "Enter your vehicle make (up to 100 characters)." };
    case "insured":
      return ["yes", "no"].includes(answers.insured) ? {} : { insured: "Choose Yes or No." };
    case "ageRange":
      return ageRanges.some((range) => range === answers.ageRange)
        ? {}
        : { ageRange: "Choose your age range." };
    case "contact": {
      const errors: FieldErrors = {};
      if (!validName(readText(answers.firstName, 100))) errors.firstName = "Enter a valid first name.";
      if (!validName(readText(answers.lastName, 100))) errors.lastName = "Enter a valid last name.";
      if (!validEmail(readText(answers.email, 254))) errors.email = "Enter a valid email address.";
      if (!normalizePhone(readText(answers.phone, 40))) errors.phone = "Enter a valid US phone number.";
      return errors;
    }
  }
}
