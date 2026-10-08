import { describe, expect, it } from "vitest";
import { averageDaysToFarmerPayment, overdueCount, paymentStage, paymentStatus } from "@/engines/payment";
import type { Payment } from "@/types";

const p = (patch: Partial<Payment> = {}): Payment => ({
  batchId: "PT-TEST",
  deliveredAt: "2026-10-12T06:30:00.000Z",
  amountRp: 1000000,
  ...patch,
});

describe("Payment Clock", () => {
  it("moves through the four stages", () => {
    expect(paymentStage(p())).toBe("delivered");
    expect(paymentStage(p({ verifiedAt: "2026-10-12T07:00:00.000Z" }))).toBe("verified");
    expect(paymentStage(p({ verifiedAt: "x", kitchenPaidAt: "2026-10-15T10:00:00.000Z" }))).toBe("kitchen_paid");
    expect(paymentStage(p({ verifiedAt: "x", kitchenPaidAt: "x", farmerPaidAt: "2026-10-16T10:00:00.000Z" }))).toBe("farmer_paid");
  });

  it("flags open payments past the SLA as overdue", () => {
    const open = p({ verifiedAt: "2026-10-12T07:00:00.000Z" });
    expect(paymentStatus(open, "2026-10-19T09:00:00.000Z", 7).overdue).toBe(false); // exactly 7 days
    expect(paymentStatus(open, "2026-10-20T09:00:00.000Z", 7).overdue).toBe(true);
    expect(paymentStatus(open, "2026-10-20T09:00:00.000Z", 7).waitingOn).toBe("kitchen_pay");
    const paid = p({ verifiedAt: "x", kitchenPaidAt: "x", farmerPaidAt: "2026-10-30T10:00:00.000Z" });
    expect(paymentStatus(paid, "2026-11-30T09:00:00.000Z", 7).overdue).toBe(false);
    expect(overdueCount([open, paid], "2026-10-26T09:00:00.000Z", 7)).toBe(1);
  });

  it("marks verified deliveries as financing-ready", () => {
    expect(paymentStatus(p(), "2026-10-12T09:00:00.000Z", 7).financingReady).toBe(false);
    expect(paymentStatus(p({ verifiedAt: "2026-10-12T07:00:00.000Z" }), "2026-10-12T09:00:00.000Z", 7).financingReady).toBe(true);
  });

  it("averages days from delivery to farmer payment", () => {
    const a = p({ farmerPaidAt: "2026-10-16T06:30:00.000Z" }); // 4 days
    const b = p({ farmerPaidAt: "2026-10-18T06:30:00.000Z" }); // 6 days
    expect(averageDaysToFarmerPayment([a, b, p()])).toBeCloseTo(5, 6);
    expect(averageDaysToFarmerPayment([p()])).toBeNull();
  });
});
