import type { GameState, ValidationIssue } from './types';

const isFiniteNonNegative = (value: number): boolean =>
  Number.isFinite(value) && value >= 0;

export function validateGameState(state: GameState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const organizationIds = new Set(state.organizations.map((item) => item.id));
  const companyIds = new Set(state.operatingCompanies.map((item) => item.organizationId));

  if (!Number.isInteger(state.quarter) || state.quarter < 1) {
    issues.push({ code: 'quarter.invalid', message: 'Quarter must be a positive integer.' });
  }

  for (const organization of state.organizations) {
    if (!Number.isSafeInteger(organization.cashCents) || !Number.isSafeInteger(organization.debtCents)) {
      issues.push({ code: 'finance.money_not_integer', message: 'Cash and debt must use integer cents.', entityId: organization.id });
    }
    if (organization.reputation < 0 || organization.reputation > 100) {
      issues.push({ code: 'organization.reputation_out_of_range', message: 'Reputation must be between 0 and 100.', entityId: organization.id });
    }
  }

  for (const company of state.operatingCompanies) {
    if (!organizationIds.has(company.organizationId)) {
      issues.push({ code: 'company.organization_missing', message: 'Operating company references a missing organization.', entityId: company.organizationId });
    }
    if (!Number.isInteger(company.issuedShares) || company.issuedShares <= 0) {
      issues.push({ code: 'ownership.issued_shares_invalid', message: 'Issued shares must be a positive integer.', entityId: company.organizationId });
    }
    const capacity = company.capacity;
    for (const [name, value] of Object.entries({
      installedITMW: capacity.installedITMW,
      gridAllocationMW: capacity.gridAllocationMW,
      commissionedEquipmentMW: capacity.commissionedEquipmentMW,
      operationalLimitMW: capacity.operationalLimitMW,
    })) {
      if (!isFiniteNonNegative(value)) {
        issues.push({ code: 'capacity.invalid', message: `${name} must be finite and non-negative.`, entityId: company.organizationId });
      }
    }
    if (!Number.isFinite(capacity.reliability) || capacity.reliability < 0 || capacity.reliability > 1) {
      issues.push({ code: 'capacity.reliability_invalid', message: 'Reliability must be between 0 and 1.', entityId: company.organizationId });
    }
    if (!isFiniteNonNegative(company.deliveredWorkloadMW)) {
      issues.push({ code: 'workload.invalid', message: 'Delivered workload must be finite and non-negative.', entityId: company.organizationId });
    }
  }

  for (const companyId of companyIds) {
    const company = state.operatingCompanies.find((item) => item.organizationId === companyId);
    if (!company) continue;
    const stakes = state.ownership.filter((stake) => stake.companyId === companyId);
    const totalShares = stakes.reduce((sum, stake) => sum + stake.shares, 0);
    const totalVotingShares = stakes.reduce((sum, stake) => sum + stake.votingShares, 0);
    if (totalShares !== company.issuedShares) {
      issues.push({
        code: 'ownership.share_ledger_mismatch',
        message: `Ownership ledger has ${totalShares} shares; ${company.issuedShares} are issued.`,
        entityId: companyId,
      });
    }
    if (totalVotingShares !== company.issuedShares) {
      issues.push({
        code: 'ownership.voting_ledger_mismatch',
        message: `Voting ledger has ${totalVotingShares} votes; ${company.issuedShares} are issued.`,
        entityId: companyId,
      });
    }
    for (const stake of stakes) {
      if (!organizationIds.has(stake.ownerId) || !Number.isInteger(stake.shares) || stake.shares < 0 ||
          !Number.isInteger(stake.votingShares) || stake.votingShares < 0) {
        issues.push({ code: 'ownership.stake_invalid', message: 'Ownership stake contains an invalid owner or share count.', entityId: companyId });
      }
    }
  }

  const projectIds = new Set<string>();\n  for (const project of state.projects) {\n    if (projectIds.has(project.id)) issues.push({ code: 'project.id_duplicate', message: 'Strategic project IDs must be unique.', entityId: project.id });\n    projectIds.add(project.id);\n    if (!Number.isInteger(project.startedQuarter) || project.startedQuarter < 1 || !Number.isInteger(project.remainingQuarters) || project.remainingQuarters < 0 || !Number.isFinite(project.leadershipCost) || project.leadershipCost < 0 || !Number.isSafeInteger(project.initialCostCents) || project.initialCostCents < 0) {\n      issues.push({ code: 'project.state_invalid', message: 'Strategic project contains invalid timing, leadership, or cost data.', entityId: project.id });\n    }\n  }\n\n  for (const contract of state.operatingCompanies.flatMap((company) => company.contracts)) {
    if (!organizationIds.has(contract.customerId) || !organizationIds.has(contract.providerId)) {
      issues.push({ code: 'contract.organization_missing', message: 'Contract references a missing organization.', entityId: contract.id });
    }
    if (!isFiniteNonNegative(contract.workloadMW) || !Number.isSafeInteger(contract.priceCentsPerMWQuarter)) {
      issues.push({ code: 'contract.value_invalid', message: 'Contract workload and price must be valid.', entityId: contract.id });
    }
  }

  return issues;
}
