import { moneyFromCents } from '../domain/money';
import type { OperatingCompanyState, OperatingPayable, OperatingPayableClass } from '../domain/types';

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
  entityId: string,
  obligations: OperatingPayableObligation[],
  availableCashCents: number,
  quarter: number,
): OperatingPayableSettlement {
  if (!entityId.trim()) throw new Error('Operating payable settlement requires a legal entity ID.');
  if (!Number.isSafeInteger(availableCashCents) || availableCashCents < 0) {
    throw new Error('Operating payable settlement requires non-negative integer cash.');
  }
  if (!Number.isInteger(quarter) || quarter < 1) {
    throw new Error('Operating payable settlement requires a positive quarter.');
  }

  const otherEntities = existing.filter((payable) => payable.entityId !== entityId);
  const entityPayables = existing.filter((payable) => payable.entityId === entityId);
  const ids = new Set(existing.map((payable) => payable.id));
  const accrued: OperatingPayable[] = obligations.map((obligation) => {
    if (!obligation.id.trim() || obligation.entityId !== entityId || ids.has(obligation.id) ||
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

  const ledger = [...entityPayables.map((payable) => ({ ...payable })), ...accrued];
  const ordered = ledger
    .map((payable, index) => ({ payable, index }))
    .filter(({ payable }) => payable.outstandingAmountCents > 0)
    .sort((a, b) =>
      a.payable.priority - b.payable.priority ||
      a.payable.dueQuarter - b.payable.dueQuarter ||
      a.payable.incurredQuarter - b.payable.incurredQuarter ||
      (a.payable.id < b.payable.id ? -1 : a.payable.id > b.payable.id ? 1 : 0));

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
    payables: [...otherEntities, ...ledger],
    payments,
    cashRemainingCents: moneyFromCents(cashRemainingCents),
    outstandingCents: moneyFromCents(ledger.reduce((sum, payable) => sum + payable.outstandingAmountCents, 0)),
  };
}

export interface OperatingCreditorPressure {
  reliabilityPenalty: number;
  gridAllocationReductionMW: number;
  affectedClasses: OperatingPayableClass[];
}

/**
 * Overdue essential suppliers can restrict service. Pressure is derived from
 * the current ledger and quarter, so it reverses automatically when claims
 * are cured and never compounds into the company's underlying capacity.
 */
export function applyOperatingCreditorPressure(
  company: OperatingCompanyState,
  payables: OperatingPayable[],
  quarter: number,
): { company: OperatingCompanyState; pressure: OperatingCreditorPressure } {
  let reliabilityPenalty = 0;
  let gridAllocationReductionMW = 0;
  const affectedClasses = new Set<OperatingPayableClass>();

  for (const payable of payables) {
    if (payable.entityId !== company.organizationId || payable.outstandingAmountCents <= 0 ||
        payable.dueQuarter >= quarter) continue;
    const overdueQuarters = Math.min(4, quarter - payable.dueQuarter);
    const severity = Math.min(1, payable.outstandingAmountCents / 100_000_000);
    const agedSeverity = overdueQuarters * severity;
    if (agedSeverity <= 0) continue;
    affectedClasses.add(payable.creditorClass);
    if (payable.creditorClass === 'energy') {
      gridAllocationReductionMW += agedSeverity * 0.5;
    } else if (payable.creditorClass === 'payroll') {
      reliabilityPenalty += agedSeverity * 0.004;
    } else if (payable.creditorClass === 'maintenance') {
      reliabilityPenalty += agedSeverity * 0.008;
    } else if (payable.creditorClass === 'network-vendor') {
      reliabilityPenalty += agedSeverity * 0.006;
    }
  }

  reliabilityPenalty = Math.min(0.08, reliabilityPenalty);
  gridAllocationReductionMW = Math.min(4, gridAllocationReductionMW);
  const actualReliabilityPenalty = Math.min(
    reliabilityPenalty,
    Math.max(0, company.capacity.reliability - 0.8),
  );
  const actualGridReduction = Math.min(gridAllocationReductionMW, company.capacity.gridAllocationMW);
  const pressure: OperatingCreditorPressure = {
    reliabilityPenalty: Number(actualReliabilityPenalty.toFixed(4)),
    gridAllocationReductionMW: Number(actualGridReduction.toFixed(3)),
    affectedClasses: [...affectedClasses].sort(),
  };
  if (actualReliabilityPenalty === 0 && actualGridReduction === 0) return { company, pressure };
  return {
    company: {
      ...company,
      capacity: {
        ...company.capacity,
        reliability: company.capacity.reliability - actualReliabilityPenalty,
        gridAllocationMW: company.capacity.gridAllocationMW - actualGridReduction,
      },
    },
    pressure,
  };
}
