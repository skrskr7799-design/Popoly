import { useState } from 'react';
import { useGameStore } from './store/gameStore';
import { SECTOR_LABELS } from './data/companies';
import { SECTOR_ABILITIES, SECTOR_ADJACENCY } from './data/sectors';
import { getPhaseConfig } from './data/economy';
import type { Sector } from './entities/types';

function App() {
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
  const [showMap, setShowMap] = useState(true);

  const currentPlayer = players[currentPlayerIndex];
  const isHumanTurn = currentPlayer && !currentPlayer.isBot;
  const selectedCompany = companies.find((c) => c.id === selectedCompanyId) ?? null;
  const knownSecrets =
    selectedCompany && currentPlayer
      ? getKnownSecrets(currentPlayer.id, selectedCompany.id)
      : [];
  const winner = winnerId ? players.find((p) => p.id === winnerId) : null;
  const phaseCfg = getPhaseConfig(phase);

  if (status === 'setup') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">
              Popoly
            </h1>
            <p className="text-zinc-400 text-sm">Tech Dominion</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <p className="text-zinc-300 text-sm leading-relaxed">
              Hardcore Big Tech warfare: shares, phases, sector synergies, espionage, reputation.
            </p>
            <button
              onClick={() =>
                initGame(['You', 'Raider Bot', 'Spymaster Bot', 'Conservative Bot'])
              }
              className="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition-colors"
            >
              Start Local Game (4 players)
            </button>
          </div>
          <p className="text-center text-xs text-zinc-600">Bots: Raider · Spymaster · Conservative</p>
        </div>
      </div>
    );
  }

  if (status === 'finished' && winner) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">
        <div className="max-w-lg w-full space-y-6 text-center">
          <div className="text-5xl">🏆</div>
          <h1 className="text-3xl font-bold text-cyan-400">{winner.name} wins!</h1>
          <p className="text-zinc-400">
            Final score: ${(getScore(winner.id) / 1_000_000).toFixed(1)}M
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
            onClick={() =>
              initGame(['You', 'Raider Bot', 'Spymaster Bot', 'Conservative Bot'])
            }
            className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-medium"
          >
            Play Again
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-bold text-cyan-400 tracking-tight">Popoly</span>
            <span className="text-zinc-500 text-sm">Turn {turn}</span>
            <span
              className="text-xs px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-200 border border-cyan-800/50"
              title={phaseCfg.description}
            >
              {phaseCfg.label}
              <span className="text-zinc-500 ml-1">r{phaseRounds}</span>
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-zinc-400">
              <span className="text-zinc-100 font-medium">{currentPlayer?.name}</span>
              {currentPlayer?.isBot && (
                <span className="ml-1 text-xs text-amber-400/80">(acting...)</span>
              )}
            </div>
            <div className="px-2 py-1 rounded-md bg-zinc-800 text-cyan-300 text-xs font-medium">
              AP {actionPointsRemaining}
            </div>
            {currentPlayer && (
              <div className="px-2 py-1 rounded-md bg-violet-950/60 text-violet-300 text-xs">
                Intel {currentPlayer.intelligenceLevel}
              </div>
            )}
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-2">
          <p className="text-[11px] text-zinc-500">{phaseCfg.description}</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 grid grid-cols-12 gap-4">
        {/* Players */}
        <section className="col-span-3 space-y-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Players / Score
          </h2>
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
                  {p.isBot && <span className="text-[10px] text-zinc-500">BOT</span>}
                </div>
                <div className="mt-1.5 text-[11px] text-zinc-400 space-y-0.5">
                  <div className="text-cyan-300/90">Score ${(score / 1e6).toFixed(1)}M</div>
                  <div>Net ${(net / 1e6).toFixed(2)}M</div>
                  <div>Cash ${(p.cash / 1e6).toFixed(2)}M</div>
                  {debt > 0 && (
                    <div className="text-rose-400/90">Debt ${(debt / 1e6).toFixed(2)}M</div>
                  )}
                  <div>
                    Rep {p.reputation} · Cred {p.creditRating} · Intel {p.intelligenceLevel}
                  </div>
                  {p.controlledCompanyIds.length > 0 && (
                    <div className="text-cyan-400/80">
                      Controls {p.controlledCompanyIds.length}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Hybrid sector map */}
          <div className="pt-2">
            <button
              onClick={() => setShowMap((v) => !v)}
              className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2"
            >
              Sector Map {showMap ? '▾' : '▸'}
            </button>
            {showMap && (
              <div className="space-y-1.5">
                {(Object.keys(SECTOR_ABILITIES) as Sector[]).map((sector) => {
                  const ab = SECTOR_ABILITIES[sector];
                  const ctrl = sectorControllers.get(sector);
                  const company = companies.find((c) => c.sector === sector);
                  return (
                    <div
                      key={sector}
                      className="text-[10px] p-2 rounded-lg border border-zinc-800 bg-zinc-900/40"
                    >
                      <div className="flex justify-between gap-1">
                        <span className="text-zinc-200 font-medium">
                          {SECTOR_LABELS[sector]}
                        </span>
                        {ctrl && <span className="text-cyan-400">{ctrl}</span>}
                      </div>
                      <div className="text-zinc-500 mt-0.5">{ab.name}</div>
                      <div className="text-zinc-600 mt-0.5 leading-snug">{ab.summary}</div>
                      {company && (
                        <button
                          className="mt-1 text-violet-400/80 hover:text-violet-300"
                          onClick={() => setSelectedCompanyId(company.id)}
                        >
                          → {company.name}
                        </button>
                      )}
                      <div className="text-zinc-700 mt-0.5">
                        links:{' '}
                        {SECTOR_ADJACENCY[sector]
                          .map((s) => SECTOR_LABELS[s].split(' ')[0])
                          .join(', ')}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Market */}
        <section className="col-span-5 space-y-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Market
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
              const ability = SECTOR_ABILITIES[company.sector];

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
                          {SECTOR_LABELS[company.sector]}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-zinc-600">{ability.name}</div>
                      <div className="mt-1 text-[11px] text-zinc-500 flex flex-wrap gap-x-2 gap-y-0.5">
                        <span>${company.sharePrice}</span>
                        <span>CF ${company.cashFlow}</span>
                        <span>Sec {company.securityLevel}</span>
                        <span>Rep {company.reputation}</span>
                        {controller && (
                          <span className="text-cyan-400">Ctrl {controller}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      {ownership > 0 && (
                        <div className="text-[11px] text-cyan-300">
                          {ownership.toFixed(0)}% ({ownedAmount})
                        </div>
                      )}
                      <div className="flex gap-0.5 justify-end">
                        {[10, 50].map((qty) => (
                          <button
                            key={`b-${qty}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              buyShares(company.id, qty);
                            }}
                            disabled={!isHumanTurn || actionPointsRemaining < 1}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 disabled:opacity-40"
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
                              className="text-[10px] px-1.5 py-0.5 rounded bg-rose-900/40 text-rose-300 disabled:opacity-40"
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

        {/* Right */}
        <section className="col-span-4 space-y-3">
          <div className="border border-zinc-800 rounded-xl bg-zinc-900/50 p-3 space-y-3">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Espionage & Defense
            </h2>

            {selectedCompany ? (
              <>
                <div className="text-sm font-medium">{selectedCompany.name}</div>
                <div className="text-[11px] text-zinc-500">
                  Sec {selectedCompany.securityLevel} · Intel{' '}
                  {currentPlayer?.intelligenceLevel ?? 0} ·{' '}
                  {SECTOR_ABILITIES[selectedCompany.sector].name}
                </div>
                <p className="text-[10px] text-zinc-600 leading-snug">
                  {SECTOR_ABILITIES[selectedCompany.sector].summary}
                </p>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => performEspionage(selectedCompany.id)}
                    disabled={!isHumanTurn || actionPointsRemaining < 1}
                    className="text-[11px] py-2 rounded-lg bg-violet-900/50 hover:bg-violet-800/60 text-violet-200 disabled:opacity-40"
                  >
                    Run Op
                  </button>
                  <button
                    onClick={() => raiseSecurity(selectedCompany.id)}
                    disabled={!isHumanTurn || actionPointsRemaining < 1}
                    className="text-[11px] py-2 rounded-lg bg-sky-950/50 hover:bg-sky-900/60 text-sky-200 disabled:opacity-40"
                  >
                    Raise Security
                  </button>
                  <button
                    onClick={() => upgradeIntelligence()}
                    disabled={!isHumanTurn || actionPointsRemaining < 1}
                    className="text-[11px] py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-40 col-span-2"
                  >
                    Upgrade Intelligence Network
                  </button>
                </div>

                {knownSecrets.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    <div className="text-[10px] text-zinc-500 uppercase">Known secrets</div>
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
                            className="w-full mt-1 text-[10px] py-1 rounded bg-rose-950/70 text-rose-200 disabled:opacity-40"
                          >
                            LEAK — damage company & controller
                          </button>
                        ) : (
                          <div className="text-[10px] text-rose-400/60">Already public</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-600">No secrets known yet. Run an op.</p>
                )}
              </>
            ) : (
              <p className="text-[11px] text-zinc-600">Select a company to spy or defend.</p>
            )}
          </div>

          <div className="space-y-2">
            <button
              onClick={nextTurn}
              disabled={!isHumanTurn}
              className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 rounded-lg text-sm font-medium"
            >
              End Turn
            </button>

            <div className="space-y-1.5">
              <p className="text-[11px] text-zinc-500 font-medium">Bank</p>
              <div className="flex gap-1">
                {[1, 2, 5].map((m) => (
                  <button
                    key={m}
                    onClick={() => takeLoan(m * 1_000_000)}
                    disabled={!isHumanTurn || actionPointsRemaining < 1}
                    className="flex-1 text-[11px] py-1.5 rounded bg-amber-900/30 text-amber-200 disabled:opacity-40"
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
                        ${(loan.remaining / 1e6).toFixed(2)}M @{' '}
                        {(loan.interestRate * 100).toFixed(1)}%
                      </span>
                      <button
                        onClick={() => repayLoan(loan.id)}
                        disabled={!isHumanTurn || currentPlayer.cash < 1000}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 disabled:opacity-40"
                      >
                        Repay
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Log
            </h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 h-44 overflow-y-auto text-[11px] space-y-1 font-mono">
              {log.map((entry, i) => (
                <div key={i} className="text-zinc-400 leading-snug">
                  {entry}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
