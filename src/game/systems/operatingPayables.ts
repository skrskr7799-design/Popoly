import { moneyFromCents } from '../domain/money';
import type { OperatingPayable, OperatingPayableClass } from '../domain/types';

export interface OperatingPayableObligation {
  id: string;
  entityId: string;
  creditorClass: OperatingPayableClass;
  amountCents: number;
  dueQuarter: number;
  priority: number;
}

export interface OperatingPayablePayment {
  payableId: string;
  entityId: string;
  amountCents: number;
}

export interface OperatingPayableSettlement {
  payables: OperatingPayable[];
  payments: OperatingPayablePayment[];
  cashRemainingCents: number;
  outstandingCents: number;
}

/**
 * Accrues current-quarter trade obligations, then pays the oldest/highest
 * priority claims first from this legal entity's explicitly supplied cash.
 * It never borrows, pools cash across entities, or silently forgives a claim.
 */
export function settleOperatingPayables(
  existing: OperatingPayable[],
  obligations: OperatingPayableObligation[],
  availableCashCents: number,
  quarter: number,
): OperatingPayableSettlement {
  if (!Number.isSafeInteger(availableCashCents) || availableCashCents < 0) {
    throw new Error('Operating payable settlement requires non-negative integer cash.');
  }
  if (!Number.isInteger(quarter) || quarter < 1) {
    throw new Error('Operating payable settlement requires a positive quarter.');
  }

  const ids = new Set(existing.map((payable) => payable.id));
  const accrued: OperatingPayable[] = obligations.map((obligation) => {
    if (!obligation.id.trim() || ids.has(obligation.id) ||
        !Number.isSafeInteger(obligation.amountCents) || obligation.amountCents <= 0 ||
        !Number.isInteger(obligation.dueQuarter) || obligation.dueQuarter < quarter ||
        !Number.isSafeInteger(obligation.priority) || obligation.priority < 1) {
      throw new Error(`Invalid or duplicate operating payable obligation: ${obligation.id}`);
    }
    ids.add(obligation.id);
    return {
      id: obligation.id,
      entityId: obligation.entityId,
      creditorClass: obligation.creditorClass,
      originalAmountCents: moneyFromCents(obligation.amountCents),
      outstandingAmountCents: moneyFromCents(obligation.amountCents),
      incurredQuarter: quarter,
      dueQuarter: obligation.dueQuarter,
      priority: obligation.priority,
    };
  });

  const ledger = [...existing.map((payable) => ({ ...payable })), ...accrued];
  const ordered = ledger
    .map((payable, index) => ({ payable, index }))
    .filter(({ payable }) => payable.outstandingAmountCents > 0)
    .sort((a, b) =>
      a.payable.priority - b.payable.priority ||
      a.payable.dueQuarter - b.payable.dueQuarter ||
      a.payable.incurredQuarter - b.payable.incurredQuarter ||
      a.payable.id.localeCompare(b.payable.id));

  let cashRemainingCents = availableCashCents;
  const payments: OperatingPayablePayment[] = [];
  for (const { payable, index } of ordered) {
    if (cashRemainingCents <= 0) break;
    const paid = Math.min(cashRemainingCents, payable.outstandingAmountCents);
    cashRemainingCents -= paid;
    ledger[index] = {
      ...ledger[index]!,
      outstandingAmountCents: moneyFromCents(payable.outstandingAmountCents - paid),
    };
    if (paid > 0) payments.push({
      payableId: payable.id,
      entityId: payable.entityId,
      amountCents: moneyFromCents(paid),
    });
  }

  return {
    payables: ledger,
    payments,
    cashRemainingCents: moneyFromCents(cashRemainingCents),
    outstandingCents: moneyFromCents(ledger.reduce((sum, payable) => sum + payable.outstandingAmountCents, 0)),
  };
}
