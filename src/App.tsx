import { useState } from 'react';
import { useGameStore } from './store/gameStore';
import { SECTOR_ABILITIES, SECTOR_ADJACENCY } from './data/sectors';
import type { Sector, EconomyPhase } from './entities/types';
import { useI18n, type TranslationKey } from './i18n';

type MobileTab = 'players' | 'market' | 'actions';

function sectorLabelKey(s: Sector): TranslationKey {
  return `sector_${s}` as TranslationKey;
}
function phaseLabelKey(p: EconomyPhase): TranslationKey {
  return `phase_${p}` as TranslationKey;
}
function phaseDescKey(p: EconomyPhase): TranslationKey {
  return `phaseDesc_${p}` as TranslationKey;
}
function abilityNameKey(s: Sector): TranslationKey {
  return `ab_${s}` as TranslationKey;
}
function abilitySummaryKey(s: Sector): TranslationKey {
  return `ab_${s}_s` as TranslationKey;
}

function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-zinc-600 hidden sm:inline">{t('language')}</span>
      <button
        type="button"
        onClick={() => setLocale('ru')}
        className={`px-2 py-1 rounded-md min-h-8 ${
          locale === 'ru' ? 'bg-cyan-900/60 text-cyan-200' : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        RU
      </button>
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={`px-2 py-1 rounded-md min-h-8 ${
          locale === 'en' ? 'bg-cyan-900/60 text-cyan-200' : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        EN
      </button>
    </div>
  );
}

function App() {
  const { t } = useI18n();
  const {
    status,
    players,
    companies,
    turn,
    phase,
    phaseRounds,
    currentPlayerIndex,
    actionPointsRemaining,
    log,
    winnerId,
    initGame,
    nextTurn,
    buyShares,
    sellShares,
    takeLoan,
    repayLoan,
    upgradeIntelligence,
    performEspionage,
    leakSecret,
    raiseSecurity,
    getOwnershipPercent,
    getPlayerShares,
    getKnownSecrets,
    getNetWorth,
    getScore,
  } = useGameStore();

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('market');

  const currentPlayer = players[currentPlayerIndex];
  const isHumanTurn = currentPlayer && !currentPlayer.isBot;
  const selectedCompany = companies.find((c) => c.id === selectedCompanyId) ?? null;
  const knownSecrets =
    selectedCompany && currentPlayer
      ? getKnownSecrets(currentPlayer.id, selectedCompany.id)
      : [];
  const winner = winnerId ? players.find((p) => p.id === winnerId) : null;

  const startNames = () => [
    t('you'),
    t('botRaider'),
    t('botSpymaster'),
    t('botConservative'),
  ];

  if (status === 'setup') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4 sm:p-8">
        <div className="max-w-md w-full space-y-6 sm:space-y-8">
          <div className="flex justify-end">
            <LanguageSwitch />
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">
              {t('appTitle')}
            </h1>
            <p className="text-zinc-400 text-sm">{t('appSubtitle')}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 sm:p-6 space-y-4">
            <p className="text-zinc-300 text-sm leading-relaxed">{t('setupBlurb')}</p>
            <button
              onClick={() => initGame(startNames())}
              className="w-full py-3.5 px-4 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-medium rounded-lg transition-colors text-base"
            >
              {t('startGame')}
            </button>
          </div>
          <p className="text-center text-xs text-zinc-600">{t('botsHint')}</p>
        </div>
      </div>
    );
  }

  if (status === 'finished' && winner) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4 sm:p-8">
        <div className="max-w-lg w-full space-y-6 text-center">
          <div className="flex justify-end">
            <LanguageSwitch />
          </div>
          <div className="text-5xl">🏆</div>
          <h1 className="text-2xl sm:text-3xl font-bold text-cyan-400">
            {winner.name} {t('winner')}
          </h1>
          <p className="text-zinc-400">
            {t('finalScore')}: ${(getScore(winner.id) / 1_000_000).toFixed(1)}M
          </p>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-left space-y-2">
            {players
              .map((p) => ({ p, score: getScore(p.id) }))
              .sort((a, b) => b.score - a.score)
              .map(({ p, score }, i) => (
                <div key={p.id} className="flex justify-between text-sm">
                  <span>
                    {i + 1}. {p.name}
                  </span>
                  <span className="text-zinc-400">${(score / 1_000_000).toFixed(1)}M</span>
                </div>
              ))}
          </div>
          <button
            onClick={() => initGame(startNames())}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-medium"
          >
            {t('playAgain')}
          </button>
        </div>
      </div>
    );
  }

  const totalDebt =
    currentPlayer?.loans.reduce((sum, l) => sum + l.remaining, 0) ?? 0;

  const sectorControllers = new Map<Sector, string>();
  for (const c of companies) {
    if (c.controlledBy) {
      const name = players.find((p) => p.id === c.controlledBy)?.name;
      if (name) sectorControllers.set(c.sector, name);
    }
  }

  const playersPanel = (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
        {t('playersScore')}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
        {players.map((p) => {
          const isCurrent = p.id === currentPlayer?.id;
          const debt = p.loans.reduce((s, l) => s + l.remaining, 0);
          const score = getScore(p.id);
          const net = getNetWorth(p.id);
          return (
            <div
              key={p.id}
              className={`p-3 rounded-lg border transition-colors ${
                isCurrent
                  ? 'border-cyan-500/50 bg-cyan-950/30'
                  : 'border-zinc-800 bg-zinc-900/50'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="font-medium text-sm">{p.name}</span>
                {p.isBot && <span className="text-[10px] text-zinc-500">{t('bot')}</span>}
              </div>
              <div className="mt-1.5 text-[11px] text-zinc-400 space-y-0.5">
                <div className="text-cyan-300/90">
                  {t('score')} ${(score / 1e6).toFixed(1)}M
                </div>
                <div>
                  {t('net')} ${(net / 1e6).toFixed(2)}M · {t('cash')} ${
                    (p.cash / 1e6).toFixed(2)
                  }M
                </div>
                {debt > 0 && (
                  <div className="text-rose-400/90">
                    {t('debt')} ${(debt / 1e6).toFixed(2)}M
                  </div>
                )}
                <div>
                  {t('rep')} {p.reputation} · {t('cred')} {p.creditRating} · {t('intel')}{' '}
                  {p.intelligenceLevel}
                </div>
                {p.controlledCompanyIds.length > 0 && (
                  <div className="text-cyan-400/80">
                    {t('controls')} {p.controlledCompanyIds.length}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2">
        <button
          onClick={() => setShowMap((v) => !v)}
          className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 min-h-9"
        >
          {t('sectorMap')} {showMap ? '▾' : '▸'}
        </button>
        {showMap && (
          <div className="space-y-1.5 max-h-64 overflow-y-auto lg:max-h-none">
            {(Object.keys(SECTOR_ABILITIES) as Sector[]).map((sector) => {
              const ctrl = sectorControllers.get(sector);
              const company = companies.find((c) => c.sector === sector);
              return (
                <div
                  key={sector}
                  className="text-[10px] p-2 rounded-lg border border-zinc-800 bg-zinc-900/40"
                >
                  <div className="flex justify-between gap-1">
                    <span className="text-zinc-200 font-medium">{t(sectorLabelKey(sector))}</span>
                    {ctrl && <span className="text-cyan-400">{ctrl}</span>}
                  </div>
                  <div className="text-zinc-500 mt-0.5">{t(abilityNameKey(sector))}</div>
                  <div className="text-zinc-600 mt-0.5 leading-snug">
                    {t(abilitySummaryKey(sector))}
                  </div>
                  {company && (
                    <button
                      className="mt-1 text-violet-400/80 min-h-8"
                      onClick={() => {
                        setSelectedCompanyId(company.id);
                        setMobileTab('market');
                      }}
                    >
                      → {company.name}
                    </button>
                  )}
                  <div className="text-zinc-700 mt-0.5">
                    {t('links')}:{' '}
                    {SECTOR_ADJACENCY[sector]
                      .map((s) => t(sectorLabelKey(s)).split(' ')[0])
                      .join(', ')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );

  const marketPanel = (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
        {t('market')}
      </h2>
      <div className="space-y-2">
        {companies.map((company) => {
          const ownership = currentPlayer
            ? getOwnershipPercent(currentPlayer.id, company.id)
            : 0;
          const ownedAmount = currentPlayer
            ? getPlayerShares(currentPlayer.id, company.id)
            : 0;
          const controller = company.controlledBy
            ? players.find((p) => p.id === company.controlledBy)?.name
            : null;
          const isSelected = selectedCompanyId === company.id;

          return (
            <div
              key={company.id}
              onClick={() => setSelectedCompanyId(company.id)}
              className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                isSelected
                  ? 'border-violet-500/60 bg-violet-950/20'
                  : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-zinc-100 text-sm">{company.name}</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      {t(sectorLabelKey(company.sector))}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-zinc-600">
                    {t(abilityNameKey(company.sector))}
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500 flex flex-wrap gap-x-2 gap-y-0.5">
                    <span>${company.sharePrice}</span>
                    <span>CF ${company.cashFlow}</span>
                    <span>
                      {t('sec')} {company.securityLevel}
                    </span>
                    <span>
                      {t('rep')} {company.reputation}
                    </span>
                    {controller && (
                      <span className="text-cyan-400">
                        {t('controls')} {controller}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  {ownership > 0 && (
                    <div className="text-[11px] text-cyan-300">
                      {ownership.toFixed(0)}% ({ownedAmount})
                    </div>
                  )}
                  <div className="flex gap-1 justify-end flex-wrap">
                    {[10, 50].map((qty) => (
                      <button
                        key={`b-${qty}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          buyShares(company.id, qty);
                        }}
                        disabled={!isHumanTurn || actionPointsRemaining < 1}
                        className="text-xs min-h-9 min-w-9 px-2 rounded-md bg-emerald-900/50 text-emerald-300 disabled:opacity-40"
                      >
                        +{qty}
                      </button>
                    ))}
                    {ownedAmount > 0 &&
                      [10, 50].map((qty) => (
                        <button
                          key={`s-${qty}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            sellShares(company.id, Math.min(qty, ownedAmount));
                          }}
                          disabled={!isHumanTurn || actionPointsRemaining < 1}
                          className="text-xs min-h-9 min-w-9 px-2 rounded-md bg-rose-900/50 text-rose-300 disabled:opacity-40"
                        >
                          -{qty}
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  const actionsPanel = (
    <section className="space-y-3">
      <div className="border border-zinc-800 rounded-xl bg-zinc-900/50 p-3 space-y-3">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          {t('espionageDefense')}
        </h2>

        {selectedCompany ? (
          <>
            <div className="text-sm font-medium">{selectedCompany.name}</div>
            <div className="text-[11px] text-zinc-500">
              {t('sec')} {selectedCompany.securityLevel} · {t('intel')}{' '}
              {currentPlayer?.intelligenceLevel ?? 0} ·{' '}
              {t(abilityNameKey(selectedCompany.sector))}
            </div>
            <p className="text-[10px] text-zinc-600 leading-snug">
              {t(abilitySummaryKey(selectedCompany.sector))}
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => performEspionage(selectedCompany.id)}
                disabled={!isHumanTurn || actionPointsRemaining < 1}
                className="text-xs py-3 rounded-lg bg-violet-900/50 text-violet-200 disabled:opacity-40 min-h-11"
              >
                {t('runOp')}
              </button>
              <button
                onClick={() => raiseSecurity(selectedCompany.id)}
                disabled={!isHumanTurn || actionPointsRemaining < 1}
                className="text-xs py-3 rounded-lg bg-sky-950/50 text-sky-200 disabled:opacity-40 min-h-11"
              >
                {t('raiseSecurity')}
              </button>
              <button
                onClick={() => upgradeIntelligence()}
                disabled={!isHumanTurn || actionPointsRemaining < 1}
                className="text-xs py-3 rounded-lg bg-zinc-800 text-zinc-300 disabled:opacity-40 col-span-2 min-h-11"
              >
                {t('upgradeIntel')}
              </button>
            </div>

            {knownSecrets.length > 0 ? (
              <div className="space-y-2 pt-1">
                <div className="text-[10px] text-zinc-500 uppercase">{t('knownSecrets')}</div>
                {knownSecrets.map((s) => (
                  <div
                    key={s.id}
                    className="text-[11px] p-2 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-1"
                  >
                    <div className="flex justify-between">
                      <span className="text-zinc-400 capitalize">{s.type}</span>
                      <span className="text-rose-400">Sev {s.severity}</span>
                    </div>
                    <p className="text-zinc-300 leading-snug">{s.description}</p>
                    {!s.leaked ? (
                      <button
                        onClick={() => leakSecret(selectedCompany.id, s.id)}
                        disabled={!isHumanTurn || actionPointsRemaining < 1}
                        className="w-full mt-1 text-[11px] py-2.5 rounded bg-rose-950/70 text-rose-200 disabled:opacity-40 min-h-10"
                      >
                        {t('leak')}
                      </button>
                    ) : (
                      <div className="text-[10px] text-rose-400/60">{t('alreadyPublic')}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-zinc-600">{t('noSecrets')}</p>
            )}
          </>
        ) : (
          <p className="text-[11px] text-zinc-600">{t('selectCompany')}</p>
        )}
      </div>

      <button
        onClick={nextTurn}
        disabled={!isHumanTurn}
        className="w-full py-3.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 rounded-lg text-sm font-medium min-h-12"
      >
        {t('endTurn')}
      </button>

      <div className="space-y-1.5">
        <p className="text-[11px] text-zinc-500 font-medium">{t('bank')}</p>
        <div className="flex gap-2">
          {[1, 2, 5].map((m) => (
            <button
              key={m}
              onClick={() => takeLoan(m * 1_000_000)}
              disabled={!isHumanTurn || actionPointsRemaining < 1}
              className="flex-1 text-xs py-3 rounded-lg bg-amber-900/30 text-amber-200 disabled:opacity-40 min-h-11"
            >
              +${m}M
            </button>
          ))}
        </div>
        {totalDebt > 0 && currentPlayer && (
          <div className="text-[11px] text-zinc-400 space-y-1">
            {currentPlayer.loans.map((loan) => (
              <div key={loan.id} className="flex justify-between items-center gap-2">
                <span>
                  ${(loan.remaining / 1e6).toFixed(2)}M @ {(loan.interestRate * 100).toFixed(1)}%
                </span>
                <button
                  onClick={() => repayLoan(loan.id)}
                  disabled={!isHumanTurn || currentPlayer.cash < 1000}
                  className="text-[11px] px-2 py-1.5 rounded bg-zinc-800 disabled:opacity-40 min-h-9"
                >
                  {t('repay')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
          {t('log')}
        </h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 h-40 sm:h-48 overflow-y-auto text-[11px] space-y-1 font-mono">
          {log.map((entry, i) => (
            <div key={i} className="text-zinc-400 leading-snug">
              {entry}
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20 lg:pb-4">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="font-bold text-cyan-400 tracking-tight">{t('appTitle')}</span>
            <span className="text-zinc-500 text-xs sm:text-sm">
              {t('turn')} {turn}
            </span>
            <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-200 border border-cyan-800/50">
              {t(phaseLabelKey(phase))}
              <span className="text-zinc-500 ml-1">r{phaseRounds}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
            <LanguageSwitch />
            <div className="text-zinc-400 truncate max-w-[7rem] sm:max-w-none">
              <span className="text-zinc-100 font-medium">{currentPlayer?.name}</span>
              {currentPlayer?.isBot && (
                <span className="ml-1 text-[10px] text-amber-400/80">{t('acting')}</span>
              )}
            </div>
            <div className="px-2 py-1 rounded-md bg-zinc-800 text-cyan-300 text-xs font-medium">
              {t('ap')} {actionPointsRemaining}
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 pb-2 hidden sm:block">
          <p className="text-[11px] text-zinc-500">{t(phaseDescKey(phase))}</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-3 sm:p-4 hidden md:grid md:grid-cols-12 gap-4">
        <div className="md:col-span-3">{playersPanel}</div>
        <div className="md:col-span-5">{marketPanel}</div>
        <div className="md:col-span-4">{actionsPanel}</div>
      </main>

      <main className="md:hidden max-w-7xl mx-auto p-3">
        {mobileTab === 'players' && playersPanel}
        {mobileTab === 'market' && marketPanel}
        {mobileTab === 'actions' && actionsPanel}
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="grid grid-cols-3">
          {(
            [
              ['players', 'players'],
              ['market', 'market'],
              ['actions', 'actions'],
            ] as const
          ).map(([id, key]) => (
            <button
              key={id}
              onClick={() => setMobileTab(id)}
              className={`py-3 text-xs font-medium min-h-14 ${
                mobileTab === id ? 'text-cyan-400' : 'text-zinc-500'
              }`}
            >
              {t(key)}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default App;
