import { useGameStore } from './store/gameStore';

function App() {
  const { status, players, turn, phase, currentPlayerIndex, log, initGame, nextTurn } =
    useGameStore();

  const currentPlayer = players[currentPlayerIndex];

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
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-cyan-400">Popoly</span>
            <span className="text-zinc-500 text-sm">Turn {turn}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
              {phase.replace('_', ' ')}
            </span>
          </div>
          <div className="text-sm text-zinc-400">
            Current: <span className="text-zinc-100 font-medium">{currentPlayer?.name}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 grid grid-cols-12 gap-4">
        <section className="col-span-3 space-y-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Players</h2>
          {players.map((p) => (
            <div
              key={p.id}
              className={`p-3 rounded-lg border ${
                p.id === currentPlayer?.id
                  ? 'border-cyan-500/50 bg-cyan-950/30'
                  : 'border-zinc-800 bg-zinc-900/50'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="font-medium">{p.name}</span>
                {p.isBot && <span className="text-[10px] text-zinc-500">BOT</span>}
              </div>
              <div className="mt-2 text-xs text-zinc-400 space-y-1">
                <div>Cash: ${(p.cash / 1_000_000).toFixed(1)}M</div>
                <div>Reputation: {p.reputation}</div>
                <div>Intel: {p.intelligenceLevel}</div>
              </div>
            </div>
          ))}
        </section>

        <section className="col-span-6 flex flex-col items-center justify-center min-h-[400px] border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
          <p className="text-zinc-500 text-sm">Hybrid board / map will live here</p>
          <p className="text-zinc-600 text-xs mt-2">Phase 1: Core loop & models</p>
        </section>

        <section className="col-span-3 space-y-4">
          <div>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Actions
            </h2>
            <button
              onClick={nextTurn}
              className="w-full py-2 px-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
            >
              End Turn
            </button>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Event Log
            </h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 h-64 overflow-y-auto text-xs space-y-1.5">
              {log.map((entry, i) => (
                <div key={i} className="text-zinc-400">
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
