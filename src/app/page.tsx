// app/page.tsx (Dashboard)
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import GameCard, {
  type GameCardData,
  type GameCardLibraryItem,
} from "@/components/GameCard";
import AddSessionModal from "@/components/AddSessionModal";

interface LibraryResponse {
  games: GameCardData[];
  count: number;
  error?: string;
}

interface ActiveSession {
  libraryItem: GameCardLibraryItem;
  gameTitle: string;
}

export default function DashboardPage() {
  const [games, setGames] = useState<GameCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);

  const fetchLibrary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/library", { cache: "no-store" });
      const data: LibraryResponse = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo cargar la biblioteca.");
      }

      setGames(data.games);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  const stats = useMemo(() => {
    let totalHistoricalHours = 0;
    let totalSessionHours = 0;
    let playingCount = 0;
    let backlogCount = 0;
    let completedCount = 0;
    let totalLibraryItems = 0;

    for (const game of games) {
      for (const item of game.libraryItems) {
        totalHistoricalHours += item.historicalHours;
        totalSessionHours += item.sessionHours;
        totalLibraryItems += 1;
        if (item.status === "PLAYING") playingCount++;
        if (item.status === "BACKLOG") backlogCount++;
        if (item.status === "COMPLETED") completedCount++;
      }
    }

    return {
      totalGames: games.length,
      totalLibraryItems,
      totalHistoricalHours: Math.round(totalHistoricalHours),
      totalSessionHours: Math.round(totalSessionHours * 10) / 10,
      totalHours: Math.round((totalHistoricalHours + totalSessionHours) * 10) / 10,
      playingCount,
      backlogCount,
      completedCount,
    };
  }, [games]);

  const handleLogSession = (libraryItem: GameCardLibraryItem, gameTitle: string) => {
    setActiveSession({ libraryItem, gameTitle });
  };

  const handleSessionSuccess = () => {
    setActiveSession(null);
    fetchLibrary();
  };

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-50">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">
          Resumen general de tu biblioteca de videojuegos.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Tiempo total jugado" value={`${stats.totalHours}h`} />
        <StatCard label="Juegos unicos" value={String(stats.totalGames)} />
        <StatCard label="Jugando ahora" value={String(stats.playingCount)} accent="emerald" />
        <StatCard label="En backlog" value={String(stats.backlogCount)} accent="slate" />
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          label="Horas historicas (imports)"
          value={`${stats.totalHistoricalHours}h`}
          hint="Volcados masivos, no reflejan interes actual"
        />
        <StatCard
          label="Horas de sesion registradas"
          value={`${stats.totalSessionHours}h`}
          accent="emerald"
          hint="Capturadas por la app desde su instalacion"
        />
        <StatCard label="Completados" value={String(stats.completedCount)} />
      </section>

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-100">Tu biblioteca</h2>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] animate-pulse rounded-xl bg-slate-900"
              />
            ))}
          </div>
        ) : games.length === 0 ? (
          <p className="text-sm text-slate-400">
            Todavia no hay juegos en tu biblioteca. Sincroniza Steam o anade uno
            manualmente desde la seccion Biblioteca.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {games.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                onLogSession={(item) => handleLogSession(item, game.title)}
              />
            ))}
          </div>
        )}
      </section>

      {activeSession && (
        <AddSessionModal
          isOpen
          onClose={() => setActiveSession(null)}
          libraryItemId={activeSession.libraryItem.id}
          gameTitle={activeSession.gameTitle}
          platformName={activeSession.libraryItem.platform}
          onSuccess={handleSessionSuccess}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "default" | "emerald" | "slate";
}) {
  const valueColor =
    accent === "emerald"
      ? "text-emerald-400"
      : accent === "slate"
      ? "text-slate-300"
      : "text-slate-50";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${valueColor}`}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}
