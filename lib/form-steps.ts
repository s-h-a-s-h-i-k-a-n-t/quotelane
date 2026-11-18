export const stepsByVariant = {
  a: ["zip", "year", "make", "insured", "ageRange", "contact"],
  b: ["zip", "insured", "contact"],
} as const;

export type Step = (typeof stepsByVariant.a)[number];
export type Variant = keyof typeof stepsByVariant;

export const ageRanges = ["18–24", "25–34", "35–44", "45–54", "55–64", "65+"] as const;

export const initialAnswers = {
  zip: "",
  year: "",
  make: "",
  insured: "",
  ageRange: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
};

export type Answers = typeof initialAnswers;
export type Field = keyof Answers;
