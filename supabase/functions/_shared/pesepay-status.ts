// Shared interpretation of a Pesepay check-payment / result payload.
//
// Per the Pesepay docs, the authoritative signal that funds were collected is
// the boolean `paid` field on the check-payment response — NOT the raw
// transaction/liquidation status string (which can read PROCESSING,
// AUTHORIZATION_SUCCESSFUL, PARTIALLY_PAID, LIQUIDATED, etc. while still being
// a completed collection). We therefore trust `paid` first and only fall back
// to a status whitelist when the field is absent.

const SUCCESS_STATUSES = new Set([
  "SUCCESS",
  "SUCCESSFUL",
  "PAID",
  "AUTHORIZED",
  "AUTHORIZATION_SUCCESSFUL",
  "COMPLETED",
  "SETTLED",
  "LIQUIDATED",
]);

const FAILED_STATUSES = new Set([
  "FAILED",
  "ERROR",
  "DECLINED",
  "INSUFFICIENT_FUNDS",
  "AUTHORIZATION_FAILED",
  "TIME_OUT",
  "TIMED_OUT",
  "TERMINATED",
  "SERVICE_UNAVAILABLE",
  "REVERSED",
  "CLOSED_PERIOD_ELAPSED",
]);

const CANCELLED_STATUSES = new Set(["CANCELLED", "CANCELED"]);

export type PesepayOutcome = {
  status: string;
  /** True when Pesepay says the money was collected. */
  paid: boolean;
  /** True when the transaction is terminal-failed (safe to mark failed). */
  failed: boolean;
  cancelled: boolean;
  /** Still in flight — do not mutate anything. */
  pending: boolean;
  amount: number;
  merchantReference: string;
  referenceNumber: string;
};

function num(...vals: unknown[]): number {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

export function interpretPesepay(inner: any): PesepayOutcome {
  const status = String(
    inner?.transactionStatus ?? inner?.transactionStatusCode ?? inner?.status ?? "",
  ).toUpperCase();

  const paidFlag = inner?.paid;
  const paid = typeof paidFlag === "boolean"
    ? paidFlag
    : String(paidFlag ?? "").toLowerCase() === "true" || SUCCESS_STATUSES.has(status);

  const cancelled = !paid && CANCELLED_STATUSES.has(status);
  const failed = !paid && !cancelled && FAILED_STATUSES.has(status);

  const d = inner?.amountDetails ?? {};
  return {
    status: status || (paid ? "SUCCESS" : "UNKNOWN"),
    paid,
    failed,
    cancelled,
    pending: !paid && !failed && !cancelled,
    amount: num(
      inner?.amount,
      d.amount,
      d.totalAmount,
      d.customerPayableAmount,
      inner?.totalAmount,
    ),
    merchantReference: String(inner?.merchantReference ?? inner?.reference ?? ""),
    referenceNumber: String(inner?.referenceNumber ?? inner?.applicationCode ?? ""),
  };
}
