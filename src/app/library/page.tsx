// app/library/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AddSessionModal from "@/components/AddSessionModal";
import type { GameCardData, GameCardLibraryItem } from "@/components/GameCard";

interface LibraryResponse {
  games: GameCardData[];
  count: number;
  error?: string;
}

interface FlatRow {
  libraryItemId: string;
  gameId: string;
  gameTitle: string;
  coverUrl: string | null;
  platform: string;
  status: GameCardLibraryItem["status"];
  historicalHours: number;
  sessionHours: number;
  totalHours: number;
  cost: number;
  currency: string;
  lastPlayedAt: string | null;
}

const STATUS_OPTIONS: Array<GameCardLibraryItem["status"] | "ALL"> = [
  "ALL",
  "BACKLOG",
  "WISHLIST",
  "PLAYING",
  "COMPLETED",
  "DROPPED",
  "ON_HOLD",
];

const STATUS_LABELS: Record<GameCardLibraryItem["status"], string> = {
  BACKLOG: "Backlog",
  WISHLIST: "Deseado",
  PLAYING: "Jugando",
  COMPLETED: "Completado",
  DROPPED: "Abandonado",
  ON_HOLD: "En pausa",
};

export default function LibraryPage() {
  const [games, setGames] = useState<GameCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_OPTIONS)[number]>("ALL");

  const [activeSession, setActiveSession] = useState<{
    libraryItemId: string;
    gameTitle: string;
    platform: string;
  } | null>(null);

  const [userId, setUserId] = useState("");
  const [steamId, setSteamId] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const fetchLibrary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/library", { cache: "no-store" });
      const data: LibraryResponse = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo cargar la biblioteca.");
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

  const rows: FlatRow[] = useMemo(() => {
    return games.flatMap((game) =>
      game.libraryItems.map((item) => ({
        libraryItemId: item.id,
        gameId: game.id,
        gameTitle: game.title,
        coverUrl: game.coverUrl,
        platform: item.platform,
        status: item.status,
        historicalHours: item.historicalHours,
        sessionHours: item.sessionHours,
        totalHours: item.totalHours,
        cost: item.cost,
        currency: item.currency,
        lastPlayedAt: item.lastPlayedAt,
      }))
    );
  }, [games]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesSearch = row.gameTitle
        .toLowerCase()
        .includes(search.trim().toLowerCase());
      const matchesStatus = statusFilter === "ALL" || row.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const handleSteamSync = async () => {
    setSyncError(null);
    setSyncMessage(null);

    if (!userId.trim()) {
      setSyncError("Introduce el userId del usuario a sincronizar.");
      return;
    }

    setIsSyncing(true);
    try {
      const res = await fetch("/api/sync/steam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId.trim(),
          steamId: steamId.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Error al sincronizar con Steam.");
      }

      const { created, updated, skipped, errors } = data.results;
      setSyncMessage(
        `Sincronizacion completada: ${created} nuevos, ${updated} actualizados, ${skipped} sin cambios${
          errors.length > 0 ? `, ${errors.length} con errores` : ""
        }.`
      );
      fetchLibrary();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Biblioteca</h1>
          <p className="mt-1 text-sm text-slate-400">
            Gestiona todos tus juegos, en todas sus plataformas.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900 p-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="userId"
              className="w-32 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-emerald-500"
            />
            <input
              value={steamId}
              onChange={(e) => setSteamId(e.target.value)}
              placeholder="SteamID64 (opcional si ya esta guardado)"
              className="w-56 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={handleSteamSync}
              disabled={isSyncing}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSyncing ? "Sincronizando..." : "Sincronizar con Steam"}
            </button>
          </div>
          {syncMessage && <p className="text-xs text-emerald-400">{syncMessage}</p>}
          {syncError && <p className="text-xs text-red-400">{syncError}</p>}
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por titulo..."
          className="w-64 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
        />
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as (typeof STATUS_OPTIONS)[number])
          }
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option === "ALL" ? "Todos los estados" : STATUS_LABELS[option]}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Juego</th>
              <th className="px-4 py-3">Plataforma</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Historico</th>
              <th className="px-4 py-3 text-right">Sesiones</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Coste</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  Cargando biblioteca...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  No hay resultados con los filtros actuales.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.libraryItemId} className="bg-slate-950 hover:bg-slate-900">
                  <td className="px-4 py-3 font-medium text-slate-100">
                    {row.gameTitle}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{row.platform}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-200">
                      {STATUS_LABELS[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400">
                    {row.historicalHours}h
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-400">
                    {row.sessionHours}h
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-100">
                    {row.totalHours}h
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400">
                    {row.cost.toFixed(2)} {row.currency}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveSession({
                          libraryItemId: row.libraryItemId,
                          gameTitle: row.gameTitle,
                          platform: row.platform,
                        })
                      }
                      className="rounded-md bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
                    >
                      + Sesion
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {activeSession && (
        <AddSessionModal
          isOpen
          onClose={() => setActiveSession(null)}
          libraryItemId={activeSession.libraryItemId}
          gameTitle={activeSession.gameTitle}
          platformName={activeSession.platform}
          onSuccess={() => {
            setActiveSession(null);
            fetchLibrary();
          }}
        />
      )}
    </div>
  );
}
