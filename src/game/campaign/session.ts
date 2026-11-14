import type { GameState } from '../domain/types';
import { advanceQuarter as resolveQuarter, type AdvanceQuarterResult, type QuarterCommands } from '../engine/advanceQuarter';
import { initializeGame } from '../engine/initialize';
import { COMPUTE_BOTTLENECK_SCENARIO_ID, COMPUTE_BOTTLENECK_SCENARIO_VERSION } from '../scenario/computeBottleneck';
import { buildQuarterReport, type QuarterReport } from '../systems/quarterReport';
import { validateGameState } from '../domain/invariants';
import { assessFinancialHealth } from '../systems/financialHealth';
import { advanceCreditorWorkouts, proposeCreditorWorkout, type CreditorWorkoutProposal, type CreditorWorkoutResult } from '../systems/creditorWorkout';
import { openAdministration as fileAdministration, reorganizeAdministration as completeReorganization, liquidateAdministration as executeLiquidation, type AdministrationTrigger, type AdministrationTransitionResult } from '../systems/administration';
import { createCampaignSave } from '../persistence/save';
import { restoreCampaign } from '../persistence/restore';
import type { CampaignSaveRepository } from '../persistence/repository';
import type { DigestProvider, LoadCompatibility, PersistenceResult } from '../persistence/types';

export const CAMPAIGN_SIMULATION_VERSION = '0.1.0';
export const GUIDED_CAMPAIGN_QUARTERS = 8;
export const CAMPAIGN_OPENING_QUARTER = 1;

export type CampaignStage = 'guided' | 'sandbox';

export interface CampaignSessionOptions {
  seed?: number;
  campaignId?: string;
  repository?: CampaignSaveRepository;
  now?: () => Date;
  idFactory?: () => string;
  digest?: DigestProvider;
}

export interface CampaignRestoreResult {
  session: CampaignSession;
  recoveredFromPrevious: boolean;
}

function createCampaignId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();

  // randomUUID() is restricted to secure contexts in some browsers. Keep the
  // game start flow working on HTTP/LAN deployments by using getRandomValues.
  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const defaultCompatibility: LoadCompatibility = {
  isSimulationCompatible: (version) => version === CAMPAIGN_SIMULATION_VERSION,
  isScenarioCompatible: (scenarioId, scenarioVersion) =>
    scenarioId === COMPUTE_BOTTLENECK_SCENARIO_ID &&
    scenarioVersion === COMPUTE_BOTTLENECK_SCENARIO_VERSION,
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Application-facing owner of one authoritative campaign.
 *
 * The engine remains pure: failed commands never replace the session state,
 * and callers only receive defensive snapshots. Persistence is explicit and
 * happens at stable quarter boundaries.
 */
export class CampaignSession {
  private stateValue: GameState;
  private reportValue: QuarterReport;
  private readonly repository?: CampaignSaveRepository;
  private readonly now: () => Date;
  private readonly digest?: DigestProvider;

  readonly campaignId: string;
  readonly createdAt: string;
  readonly simulationVersion: string;
  readonly recoveredFromPrevious: boolean;

  private constructor(args: {
    state: GameState;
    campaignId: string;
    createdAt: string;
    simulationVersion: string;
    repository?: CampaignSaveRepository;
    now: () => Date;
    digest?: DigestProvider;
    recoveredFromPrevious?: boolean;
  }) {
    this.stateValue = clone(args.state);
    this.reportValue = buildQuarterReport(this.stateValue);
    this.campaignId = args.campaignId;
    this.createdAt = args.createdAt;
    this.simulationVersion = args.simulationVersion;
    this.repository = args.repository;
    this.now = args.now;
    this.digest = args.digest;
    this.recoveredFromPrevious = args.recoveredFromPrevious ?? false;
  }

  static start(options: CampaignSessionOptions = {}): CampaignSession {
    const now = options.now ?? (() => new Date());
    const createdAt = now().toISOString();
    const campaignId = options.campaignId ?? (options.idFactory ?? createCampaignId)();
    if (!campaignId.trim()) throw new Error('Campaign ID must not be empty.');

    return new CampaignSession({
      state: initializeGame(options.seed),
      campaignId,
      createdAt,
      simulationVersion: CAMPAIGN_SIMULATION_VERSION,
      repository: options.repository,
      now,
      digest: options.digest,
    });
  }

  static async restore(
    campaignId: string,
    repository: CampaignSaveRepository,
    options: Pick<CampaignSessionOptions, 'now' | 'digest'> = {},
  ): Promise<PersistenceResult<CampaignRestoreResult>> {
    const compatibility = defaultCompatibility;
    const restored = await restoreCampaign(repository, campaignId, compatibility, options.digest);
    if (!restored.ok) return restored;

    const session = new CampaignSession({
      state: restored.value.state,
      campaignId: restored.value.save.campaignId,
      createdAt: restored.value.save.createdAt,
      simulationVersion: restored.value.save.simulationVersion,
      repository,
      now: options.now ?? (() => new Date()),
      digest: options.digest,
      recoveredFromPrevious: restored.value.recoveredFromPrevious,
    });
    return {
      ok: true,
      value: { session, recoveredFromPrevious: restored.value.recoveredFromPrevious },
    };
  }

  get state(): GameState {
    return clone(this.stateValue);
  }

  get currentReport(): QuarterReport {
    return clone(this.reportValue);
  }

  get completedQuarters(): number {
    return Math.max(0, this.stateValue.quarter - CAMPAIGN_OPENING_QUARTER);
  }

  get stage(): CampaignStage {
    return this.completedQuarters >= GUIDED_CAMPAIGN_QUARTERS ? 'sandbox' : 'guided';
  }

  /** Resolve one quarter atomically; a rejected turn leaves session state untouched. */
  advance(commands: QuarterCommands = {}): AdvanceQuarterResult {
    const result = resolveQuarter(this.stateValue, commands);
    if (!result.ok) return result;

    const workoutState = advanceCreditorWorkouts(result.state, result.report);
    const workoutIssues = validateGameState(workoutState);
    if (workoutIssues.length > 0) return { ok: false, issues: workoutIssues };
    this.stateValue = clone(workoutState);
    // Keep the session's planning report aligned with the new decision quarter.
    // The resolved quarter report is returned to the caller for the review screen.
    this.reportValue = buildQuarterReport(this.stateValue);
    return { ok: true, state: clone(workoutState), report: clone(result.report) };
  }

  /** Open a formal administration case without changing cash or creditor balances. */
  openAdministration(entityId: string, trigger: AdministrationTrigger = 'voluntary'): AdministrationTransitionResult {
    const result = fileAdministration(this.stateValue, entityId, trigger);
    if (!result.ok) return result;
    const issues = validateGameState(result.state);
    if (issues.length > 0) return {
      ok: false, code: 'administration.state_invalid',
      message: issues.map((item) => item.message).join(' '),
    };
    this.stateValue = clone(result.state);
    this.reportValue = buildQuarterReport(this.stateValue);
    return { ...result, state: clone(result.state) };
  }

  /** Exit administration only after operating liquidity and creditor arrears are back under control. */
  reorganizeAdministration(caseId: string): AdministrationTransitionResult {
    const administrationCase = this.stateValue.administrationCases?.find((item) => item.id === caseId);
    if (!administrationCase || administrationCase.status !== 'active') {
      return { ok: false, code: 'administration.case_not_active', message: 'Only an active administration case can be reorganized.' };
    }
    const unresolvedWorkout = (this.stateValue.creditorWorkouts ?? []).find((item) =>
      item.entityId === administrationCase.entityId && (item.status === 'active' || item.status === 'breached'));
    if (unresolvedWorkout) return {
      ok: false, code: 'administration.workout_unresolved',
      message: 'The creditor workout must complete its recovery milestones before administration can close.',
    };
    const health = assessFinancialHealth(this.stateValue, this.reportValue, administrationCase.entityId);
    if (!health || health.status !== 'stable' || health.operatingPayablesCents > 0 ||
        health.debtArrearsCents > 0 || health.defaultedDebtCount > 0 || health.covenantBreachCount > 0) {
      return {
        ok: false, code: 'administration.reorganization_not_viable',
        message: 'Reorganization requires non-distressed operations, cleared trade payables and debt arrears, and no active debt default or covenant breach.',
      };
    }
    const result = completeReorganization(this.stateValue, caseId);
    if (!result.ok) return result;
    const issues = validateGameState(result.state);
    if (issues.length > 0) return {
      ok: false, code: 'administration.state_invalid',
      message: issues.map((item) => item.message).join(' '),
    };
    this.stateValue = clone(result.state);
    this.reportValue = buildQuarterReport(this.stateValue);
    return { ...result, state: clone(result.state) };
  }

  /** Submit a coordinated workout; votes and approved concessions commit atomically. */
  proposeCreditorWorkout(proposal: CreditorWorkoutProposal): CreditorWorkoutResult {
    const result = proposeCreditorWorkout(this.stateValue, proposal);
    if (!result.ok) return result;
    const issues = validateGameState(result.state);
    if (issues.length > 0) return {
      ok: false, code: 'workout.state_invalid',
      message: issues.map((item) => item.message).join(' '),
    };
    this.stateValue = clone(result.state);
    this.reportValue = buildQuarterReport(this.stateValue);
    return { ...result, state: clone(result.state) };
  }

  /** Execute the final creditor waterfall and close an active administration case. */
  liquidateAdministration(caseId: string): AdministrationTransitionResult {
    const result = executeLiquidation(this.stateValue, caseId);
    if (!result.ok) return result;
    const issues = validateGameState(result.state);
    if (issues.length > 0) return {
      ok: false, code: 'administration.state_invalid',
      message: issues.map((item) => item.message).join(' '),
    };
    this.stateValue = clone(result.state);
    this.reportValue = buildQuarterReport(this.stateValue);
    return { ...result, state: clone(result.state) };
  }

  /** Persist the current stable quarter boundary; no autosave occurs implicitly. */
  async save(): Promise<PersistenceResult<void>> {
    if (!this.repository) {
      return {
        ok: false,
        error: {
          code: 'campaign.repository_unavailable',
          message: 'This campaign session has no save repository configured.',
        },
      };
    }

    try {
      const timestamp = Math.max(Date.parse(this.createdAt), this.now().getTime());
      const created = await createCampaignSave(this.stateValue, {
        campaignId: this.campaignId,
        createdAt: this.createdAt,
        updatedAt: new Date(timestamp).toISOString(),
        simulationVersion: this.simulationVersion,
      }, this.digest);
      if (!created.ok) return created;
      return await this.repository.commit(created.value);
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'campaign.save_failed',
          message: error instanceof Error ? error.message : 'Campaign save failed unexpectedly.',
        },
      };
    }
  }
}
