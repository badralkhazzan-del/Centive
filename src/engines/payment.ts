import type { Payment } from "@/types";

// 6.6 Payment Clock: delivered -> verified by kitchen -> kitchen paid Kopdes ->
// Kopdes paid farmers. Anything still open past the kitchen's SLA (days since
// delivery) is overdue. Verified deliveries are "PO-verified, financing-ready":
// a record that could support working-capital financing in a future integration.

export type PaymentStage = "delivered" | "verified" | "kitchen_paid" | "farmer_paid";

export const STAGES: PaymentStage[] = ["delivered", "verified", "kitchen_paid", "farmer_paid"];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function paymentStage(p: Payment): PaymentStage {
  if (p.farmerPaidAt) return "farmer_paid";
  if (p.kitchenPaidAt) return "kitchen_paid";
  if (p.verifiedAt) return "verified";
  return "delivered";
}

export interface PaymentStatus {
  stage: PaymentStage;
  stageIndex: number;
  daysOpen: number;
  overdue: boolean;
  /** Who the next step waits on. */
  waitingOn: "kitchen_verify" | "kitchen_pay" | "kopdes_pay" | null;
  financingReady: boolean;
  daysToFarmerPayment: number | null;
}

export function daysBetweenTimes(a: string, b: string): number {
  return (Date.parse(b) - Date.parse(a)) / DAY;
}

/** Whole calendar days between two timestamps (SLA counting). */
export function calendarDays(a: string, b: string): number {
  return Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / DAY);
}

export function paymentStatus(p: Payment, nowIso: string, slaDays: number): PaymentStatus {
  const stage = paymentStage(p);
  const done = stage === "farmer_paid";
  const end = done ? p.farmerPaidAt! : nowIso;
  const daysOpen = Math.max(0, calendarDays(p.deliveredAt, end));
  const waitingOn =
    stage === "delivered" ? "kitchen_verify" : stage === "verified" ? "kitchen_pay" : stage === "kitchen_paid" ? "kopdes_pay" : null;
  return {
    stage,
    stageIndex: STAGES.indexOf(stage),
    daysOpen,
    overdue: !done && daysOpen > slaDays,
    waitingOn,
    financingReady: Boolean(p.verifiedAt),
    daysToFarmerPayment: done ? daysBetweenTimes(p.deliveredAt, p.farmerPaidAt!) : null,
  };
}

/** Average days from delivery to farmer payment, over completed payments. */
export function averageDaysToFarmerPayment(payments: Payment[]): number | null {
  const done = payments.filter((p) => p.farmerPaidAt);
  if (done.length === 0) return null;
  return done.reduce((s, p) => s + daysBetweenTimes(p.deliveredAt, p.farmerPaidAt!), 0) / done.length;
}

export function overdueCount(payments: Payment[], nowIso: string, slaDays: number): number {
  return payments.filter((p) => paymentStatus(p, nowIso, slaDays).overdue).length;
}
