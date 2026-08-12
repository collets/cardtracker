export const ALERT_FEEDBACK_OUTCOMES = [
  "purchased",
  "useful",
  "unavailable",
  "not_a_deal",
  "wrong_details",
  "shipping_too_expensive",
] as const;

export type AlertFeedbackOutcome = (typeof ALERT_FEEDBACK_OUTCOMES)[number];

export const ALERT_FEEDBACK_OPTIONS: ReadonlyArray<{
  value: AlertFeedbackOutcome;
  label: string;
  description: string;
}> = [
  {
    value: "purchased",
    label: "Bought it",
    description: "I purchased this listing after seeing the alert.",
  },
  {
    value: "useful",
    label: "Good deal, skipped",
    description: "The alert was useful, but I chose not to buy it.",
  },
  {
    value: "unavailable",
    label: "Already gone",
    description: "The listing was no longer available when I opened it.",
  },
  {
    value: "not_a_deal",
    label: "Not a real deal",
    description: "The price or comparison did not feel genuinely valuable.",
  },
  {
    value: "wrong_details",
    label: "Wrong details",
    description: "The language, condition, finish, or printing did not match.",
  },
  {
    value: "shipping_too_expensive",
    label: "Shipping too high",
    description: "Delivery costs removed the apparent saving.",
  },
];

export function alertFeedbackLabel(outcome: AlertFeedbackOutcome) {
  return (
    ALERT_FEEDBACK_OPTIONS.find((option) => option.value === outcome)?.label ??
    outcome
  );
}
