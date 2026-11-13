import { useState } from 'react';
import { useGameStore } from './store/gameStore';
import { SECTOR_LABELS } from './data/companies';

function App() {
  const {
    status,
    players,
    companies,
    turn,
    phase,
    currentPlayerIndex,
    actionPointsRemaining,
    log,
    initGame,
    nextTurn,
    buyShares,
    sellShares,
    takeLoan,
    repayLoan,
    upgradeIntelligence,
    performEspionage,
    leakSecret,
    getOwnershipPercent,
    getPlayerShares,
    getKnownSecrets,
  } = useGameStore();

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const currentPlayer = players[currentPlayerIndex];
  const isHumanTurn = currentPlayer && !currentPlayer.isBot;
  const selectedCompany = companies.find((c) => c.id === selectedCompanyId) ?? null;
  const knownSecrets =
    selectedCompany && currentPlayer
      ? getKnownSecrets(currentPlayer.id, selectedCompany.id)
      : [];

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
              Hardcore economic strategy. Companies, shares, loans, events, espionage and reputation.
            </p>
            <button
              onClick={() => initGame(['You', 'Bot Alpha', 'Bot Beta', 'Bot Gamma'])}
              className="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition-colors"
            >
              Start Local Game (4 players)
            </button>
          </div>
          <p className="text-center text-xs text-zinc-600">Design document: DESIGN.md</p>
        </div>
      </div>
    );
  }

  const totalDebt =
    currentPlayer?.loans.reduce((sum, l) => sum + l.remaining, 0) ?? 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-bold text-cyan-400 tracking-tight">Popoly</span>
            <span className="text-zinc-500 text-sm">Turn {turn}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 capitalize">
              {phase.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-zinc-400">
              Current:{' '}
              <span className="text-zinc-100 font-medium">{currentPlayer?.name}</span>
              {currentPlayer?.isBot && (
                <span className="ml-1 text-xs text-amber-400/80">(acting...)</span>
              )}
            </div>
            <div className="px-2.5 py-1 rounded-md bg-zinc-800 text-cyan-300 text-xs font-medium">
              AP: {actionPointsRemaining}
            </div>
            {currentPlayer && (
              <div className="px-2.5 py-1 rounded-md bg-violet-950/60 text-violet-300 text-xs font-medium">
                Intel Lv {currentPlayer.intelligenceLevel}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 grid grid-cols-12 gap-4">
        {/* Players */}
        <section className="col-span-3 space-y-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Players</h2>
          {players.map((p) => {
            const isCurrent = p.id === currentPlayer?.id;
            const debt = p.loans.reduce((s, l) => s + l.remaining, 0);
            return (
              <div
                key={p.id}
                className={`p-3 rounded-lg border transition-colors ${
                  isCurrent ? 'border-cyan-500/50 bg-cyan-950/30' : 'border-zinc-800 bg-zinc-900/50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-medium">{p.name}</span>
                  {p.isBot && <span className="text-[10px] text-zinc-500 uppercase">Bot</span>}
                </div>
                <div className="mt-2 text-xs text-zinc-400 space-y-1">
                  <div>Cash: ${(p.cash / 1_000_000).toFixed(2)}M</div>
                  {debt > 0 && (
                    <div className="text-rose-400/90">Debt: ${(debt / 1_000_000).toFixed(2)}M</div>
                  )}
                  <div>Rep {p.reputation} · Credit {p.creditRating}</div>
                  <div>Intel {p.intelligenceLevel}</div>
                  {p.controlledCompanyIds.length > 0 && (
                    <div className="text-cyan-400/80">Controls: {p.controlledCompanyIds.length}</div>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {/* Market */}
        <section className="col-span-5 space-y-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Market — Companies
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
                          {SECTOR_LABELS[company.sector]}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-500 flex flex-wrap gap-x-2.5 gap-y-0.5">
                        <span>${company.sharePrice}</span>
                        <span>CF ${company.cashFlow}</span>
                        <span>Sec {company.securityLevel}</span>
                        <span>Rep {company.reputation}</span>
                        {controller && <span className="text-cyan-400">Ctrl: {controller}</span>}
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
                            className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 disabled:opacity-40"
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
                              className="text-[10px] px-1.5 py-0.5 rounded bg-rose-900/40 hover:bg-rose-800/60 text-rose-300 disabled:opacity-40"
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

        {/* Right: Espionage + Actions + Log */}
        <section className="col-span-4 space-y-4">
          {/* Espionage panel */}
          <div className="border border-zinc-800 rounded-xl bg-zinc-900/50 p-3 space-y-3">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Espionage
            </h2>

            {selectedCompany ? (
              <>
                <div className="text-sm font-medium text-zinc-200">{selectedCompany.name}</div>
                <div className="text-[11px] text-zinc-500">
                  Security {selectedCompany.securityLevel} · Your Intel{' '}
                  {currentPlayer?.intelligenceLevel}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => performEspionage(selectedCompany.id)}
                    disabled={!isHumanTurn || actionPointsRemaining < 1}
                    className="flex-1 text-xs py-2 rounded-lg bg-violet-900/50 hover:bg-violet-800/60 text-violet-200 disabled:opacity-40 transition-colors"
                  >
                    Run Op (gather intel)
                  </button>
                  <button
                    onClick={() => upgradeIntelligence()}
                    disabled={!isHumanTurn || actionPointsRemaining < 1}
                    className="text-xs px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-40 transition-colors"
                    title="Upgrade Intelligence Network"
                  >
                    Upgrade Intel
                  </button>
                </div>

                {knownSecrets.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    <div className="text-[11px] text-zinc-500 uppercase">Known secrets</div>
                    {knownSecrets.map((s) => (
                      <div
                        key={s.id}
                        className="text-[11px] p-2 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-1.5"
                      >
                        <div className="flex justify-between gap-2">
                          <span className="text-zinc-400 capitalize">{s.type}</span>
                          <span className="text-rose-400/90">Sev {s.severity}/10</span>
                        </div>
                        <p className="text-zinc-300 leading-snug">{s.description}</p>
                        {!s.leaked && (
                          <button
                            onClick={() => leakSecret(selectedCompany.id, s.id)}
                            disabled={!isHumanTurn || actionPointsRemaining < 1}
                            className="w-full mt-1 text-[10px] py-1 rounded bg-rose-950/60 hover:bg-rose-900/70 text-rose-200 disabled:opacity-40"
                          >
                            LEAK (damage company)
                          </button>
                        )}
                        {s.leaked && (
                          <div className="text-[10px] text-rose-400/70">Already public</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-600">
                    No secrets discovered yet. Run an op to try.
                  </p>
                )}
              </>
            ) : (
              <p className="text-[11px] text-zinc-600">
                Select a company on the left to run espionage.
              </p>
            )}
          </div>

          {/* Bank + End turn */}
          <div className="space-y-2">
            <button
              onClick={nextTurn}
              disabled={!isHumanTurn}
              className="w-full py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
            >
              End Turn
            </button>

            <div className="pt-1 space-y-1.5">
              <p className="text-[11px] text-zinc-500 font-medium">Bank Loans</p>
              <div className="flex gap-1">
                {[1, 2, 5].map((m) => (
                  <button
                    key={m}
                    onClick={() => takeLoan(m * 1_000_000)}
                    disabled={!isHumanTurn || actionPointsRemaining < 1}
                    className="flex-1 text-[11px] py-1.5 rounded bg-amber-900/30 hover:bg-amber-800/50 text-amber-200 disabled:opacity-40"
                  >
                    +${m}M
                  </button>
                ))}
              </div>
              {totalDebt > 0 && currentPlayer && (
                <div className="text-[11px] text-zinc-400 space-y-1">
                  <div>Debt: ${(totalDebt / 1_000_000).toFixed(2)}M</div>
                  {currentPlayer.loans.map((loan) => (
                    <div key={loan.id} className="flex items-center justify-between gap-2">
                      <span>
                        ${(loan.remaining / 1_000_000).toFixed(2)}M @{' '}
                        {(loan.interestRate * 100).toFixed(1)}%
                      </span>
                      <button
                        onClick={() => repayLoan(loan.id)}
                        disabled={!isHumanTurn || currentPlayer.cash < 1000}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40"
                      >
                        Repay
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Log */}
          <div>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Event Log
            </h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 h-56 overflow-y-auto text-[11px] space-y-1 font-mono">
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
