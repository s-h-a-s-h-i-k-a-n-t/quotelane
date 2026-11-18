"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { consentText } from "@/lib/consent";
import { ageRanges, initialAnswers, stepsByVariant, type Answers, type Field, type Variant } from "@/lib/form-steps";
import { validateStep, type FieldErrors } from "@/lib/validation";

const stepTitles = {
  zip: "Get auto insurance quotes",
  year: "What year is your vehicle?",
  make: "What is your vehicle make?",
  insured: "Are you currently insured?",
  ageRange: "What is your age range?",
  contact: "Where can we reach you?",
};

export default function QuoteForm({
  variant,
  prefill,
  sessionKey,
  override,
}: {
  variant: Variant;
  prefill: Partial<Answers>;
  sessionKey: string;
  override?: Variant;
}) {
  const router = useRouter();
  const steps = stepsByVariant[variant];
  const nextQuestion = (start: number) => {
    const index = steps.findIndex((step, index) => index >= start && (
      step === "contact" || step === "ageRange" || step === "make" || !prefill[step]
    ));
    return index < 0 ? steps.length - 1 : index;
  };
  const [index, setIndex] = useState(() => nextQuestion(0));
  const [answers, setAnswers] = useState(() => ({ ...initialAnswers, ...prefill }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const step = steps[index];
  const isContact = step === "contact";

  function updateAnswer(field: Field, value: string) {
    setAnswers((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError("");
  }

  function goBack() {
    setErrors({});
    setSubmitError("");
    setIndex(index - 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    const nextErrors = validateStep(step, answers);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    if (!isContact) {
      setIndex(nextQuestion(index + 1));
      return;
    }

    const contact = {
      zip: answers.zip.trim(),
      insured: answers.insured === "yes",
      firstName: answers.firstName.trim(),
      lastName: answers.lastName.trim(),
      email: answers.email.trim(),
      phone: answers.phone.trim(),
    };
    const payload = variant === "a"
      ? { ...contact, year: Number(answers.year), make: answers.make.trim(), ageRange: answers.ageRange }
      : contact;

    submitting.current = true;
    setPending(true);
    setSubmitError("");

    try {
      const endpoint = override ? `/api/leads?variant=${override}` : "/api/leads";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, sessionKey }),
      });

      if (response.ok) {
        router.replace("/thank-you");
        return;
      }

      if (response.status === 404 || response.status === 405) {
        setSubmitError("Quote submission is unavailable right now.");
      } else if (response.status === 409) {
        setSubmitError("This email or phone number was used for a quote request in the past 24 hours.");
      } else if (response.status === 429) {
        setSubmitError("Too many requests. Wait a moment and try again.");
      } else if (response.status === 410) {
        setSubmitError("This form session ended. Reload the page to start again.");
      } else {
        setSubmitError("We couldn’t submit your request. Check your answers and try again.");
      }
    } catch {
      setSubmitError("We couldn’t connect. Check your connection and try again.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  function fieldError(field: Field) {
    return errors[field] && <p className="quote-error" id={`${field}-error`} role="alert">{errors[field]}</p>;
  }

  function textField(
    field: Field,
    label: string,
    options: {
      type?: "text" | "email" | "tel";
      inputMode?: "numeric";
      autoComplete?: string;
      placeholder?: string;
    } = {},
  ) {
    return (
      <div className="quote-field">
        <label htmlFor={field}>{label}</label>
        <input
          id={field}
          name={field}
          type="text"
          {...options}
          value={answers[field]}
          aria-invalid={Boolean(errors[field])}
          aria-describedby={errors[field] ? `${field}-error` : undefined}
          onChange={(event) => updateAnswer(field, event.currentTarget.value)}
        />
        {fieldError(field)}
      </div>
    );
  }

  return (
    <>
      <div className="quote-progress">
        <label htmlFor="quote-progress">Step {index + 1} of {steps.length}</label>
        <progress id="quote-progress" value={index + 1} max={steps.length} />
      </div>

      <h1>{stepTitles[step]}</h1>
      {step === "zip" && <p className="quote-intro">Enter your ZIP code to get started.</p>}

      <form className="quote-form" onSubmit={handleSubmit} noValidate>
        <fieldset className="quote-fields" disabled={pending}>
          {step === "zip" && textField("zip", "ZIP code", {
            inputMode: "numeric", autoComplete: "postal-code", placeholder: "90210",
          })}
          {step === "year" && textField("year", "Model year", {
            inputMode: "numeric", placeholder: "2020",
          })}
          {step === "make" && textField("make", "Vehicle make")}
          {step === "insured" && (
            <fieldset className="quote-options" aria-label="Current insurance status"
              aria-describedby={errors.insured ? "insured-error" : undefined}>
              {(["yes", "no"] as const).map((value) => (
                <label className="quote-option" key={value}>
                  <input
                    type="radio"
                    name="insured"
                    value={value}
                    checked={answers.insured === value}
                    onChange={() => updateAnswer("insured", value)}
                  />
                  {value === "yes" ? "Yes" : "No"}
                </label>
              ))}
              {fieldError("insured")}
            </fieldset>
          )}
          {step === "ageRange" && (
            <div className="quote-field">
              <label htmlFor="ageRange">Age range</label>
              <select
                id="ageRange"
                name="ageRange"
                value={answers.ageRange}
                aria-invalid={Boolean(errors.ageRange)}
                aria-describedby={errors.ageRange ? "ageRange-error" : undefined}
                onChange={(event) => updateAnswer("ageRange", event.currentTarget.value)}
              >
                <option value="">Select an age range</option>
                {ageRanges.map((range) => <option key={range} value={range}>{range}</option>)}
              </select>
              {fieldError("ageRange")}
            </div>
          )}
          {isContact && (
            <>
              <div className="quote-name">
                {textField("firstName", "First name", { autoComplete: "given-name" })}
                {textField("lastName", "Last name", { autoComplete: "family-name" })}
              </div>
              {textField("email", "Email", { type: "email", autoComplete: "email" })}
              {textField("phone", "Phone number", { type: "tel", autoComplete: "tel" })}
            </>
          )}
        </fieldset>

        {submitError && <p className="quote-error" role="alert">{submitError}</p>}
        {isContact && <p className="quote-consent" id="lead-consent">{consentText}</p>}

        <button className="quote-button" type="submit" disabled={pending}
          aria-describedby={isContact ? "lead-consent" : undefined}>
          {pending ? "Submitting…" : isContact ? "Get My Quotes" : "Continue"}
        </button>
        {index > 0 && (
          <button type="button" className="quote-back" onClick={goBack} disabled={pending}>Back</button>
        )}
      </form>
    </>
  );
}
