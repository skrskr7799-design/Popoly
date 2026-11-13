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
    getOwnershipPercent,
    getPlayerShares,
  } = useGameStore();

  const currentPlayer = players[currentPlayerIndex];
  const isHumanTurn = currentPlayer && !currentPlayer.isBot;

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
              Hardcore economic strategy in the near-future Big Tech world.
              Companies. Shares. Espionage. Reputation. War.
            </p>
            <button
              onClick={() => initGame(['You', 'Bot Alpha', 'Bot Beta', 'Bot Gamma'])}
              className="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition-colors"
            >
              Start Local Game (4 players)
            </button>
          </div>

          <p className="text-center text-xs text-zinc-600">
            Design document: DESIGN.md
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top bar */}
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
                <span className="ml-1 text-xs text-amber-400/80">(thinking...)</span>
              )}
            </div>
            <div className="px-2.5 py-1 rounded-md bg-zinc-800 text-cyan-300 text-xs font-medium">
              AP: {actionPointsRemaining}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 grid grid-cols-12 gap-4">
        {/* Left: Players */}
        <section className="col-span-3 space-y-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Players
          </h2>
          {players.map((p) => {
            const isCurrent = p.id === currentPlayer?.id;
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
                  <span className="font-medium">{p.name}</span>
                  {p.isBot && (
                    <span className="text-[10px] text-zinc-500 uppercase">Bot</span>
                  )}
                </div>
                <div className="mt-2 text-xs text-zinc-400 space-y-1">
                  <div>Cash: ${(p.cash / 1_000_000).toFixed(2)}M</div>
                  <div>Reputation: {p.reputation}</div>
                  <div>Intel Lv: {p.intelligenceLevel}</div>
                  {p.controlledCompanyIds.length > 0 && (
                    <div className="text-cyan-400/80">
                      Controls: {p.controlledCompanyIds.length}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {/* Center: Market */}
        <section className="col-span-6 space-y-3">
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

              return (
                <div
                  key={company.id}
                  className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-zinc-100">{company.name}</h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                          {SECTOR_LABELS[company.sector]}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 flex flex-wrap gap-x-3 gap-y-1">
                        <span>Price: <span className="text-zinc-300">${company.sharePrice}</span></span>
                        <span>Val: ${(company.valuation / 1000).toFixed(0)}k</span>
                        <span>CF: ${company.cashFlow}</span>
                        <span>Dev {company.developmentLevel}</span>
                        <span>Sec {company.securityLevel}</span>
                        {controller && (
                          <span className="text-cyan-400">Ctrl: {controller}</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 space-y-1">
                      {ownership > 0 && (
                        <div className="text-xs text-cyan-300">
                          You: {ownership.toFixed(1)}% ({ownedAmount})
                        </div>
                      )}
                      <div className="flex gap-1 justify-end">
                        {[10, 50].map((qty) => (
                          <button
                            key={`buy-${qty}`}
                            onClick={() => buyShares(company.id, qty)}
                            disabled={!isHumanTurn || actionPointsRemaining < 1}
                            className="text-[11px] px-2 py-1 rounded bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            title={`Buy ${qty} shares`}
                          >
                            +{qty}
                          </button>
                        ))}
                        {ownedAmount > 0 &&
                          [10, 50].map((qty) => (
                            <button
                              key={`sell-${qty}`}
                              onClick={() => sellShares(company.id, Math.min(qty, ownedAmount))}
                              disabled={!isHumanTurn || actionPointsRemaining < 1}
                              className="text-[11px] px-2 py-1 rounded bg-rose-900/40 hover:bg-rose-800/60 text-rose-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              title={`Sell ${Math.min(qty, ownedAmount)} shares`}
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

        {/* Right: Actions + Log */}
        <section className="col-span-3 space-y-4">
          <div>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Actions
            </h2>
            <div className="space-y-2">
              <button
                onClick={nextTurn}
                disabled={!isHumanTurn}
                className="w-full py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
              >
                End Turn
              </button>
              <p className="text-[11px] text-zinc-600 px-1 leading-relaxed">
                Buy / Sell costs 1 AP each.
                Dividends are paid at the start of every new round.
                Bots act automatically.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Event Log
            </h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 h-80 overflow-y-auto text-xs space-y-1.5 font-mono">
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
