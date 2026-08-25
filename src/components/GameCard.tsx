"use client";

import Image from "next/image";
import { useState } from "react";

export interface GameCardLibraryItem {
  id: string;
  localTitle: string;
  status: "BACKLOG" | "WISHLIST" | "PLAYING" | "COMPLETED" | "DROPPED" | "ON_HOLD";
  cost: number;
  currency: string;
  historicalHours: number;
  sessionHours: number;
  totalHours: number;
  platform: string;
  platformType: string;
  lastPlayedAt: string | null;
  addedAt: string;
}

export interface GameCardData {
  id: string;
  title: string;
  coverUrl: string | null;
  genres: string[] | null;
  averageHoursToBeat: number | null;
  grandTotalHours: number;
  platformCount: number;
  libraryItems: GameCardLibraryItem[];
}

interface GameCardProps {
  game: GameCardData;
  onLogSession?: (libraryItem: GameCardLibraryItem) => void;
}

const STATUS_STYLES: Record<GameCardLibraryItem["status"], string> = {
  BACKLOG: "bg-slate-700 text-slate-200",
  WISHLIST: "bg-purple-700/60 text-purple-100",
  PLAYING: "bg-emerald-600/80 text-emerald-50",
  COMPLETED: "bg-blue-600/80 text-blue-50",
  DROPPED: "bg-red-700/70 text-red-100",
  ON_HOLD: "bg-amber-600/80 text-amber-50",
};

const STATUS_LABELS: Record<GameCardLibraryItem["status"], string> = {
  BACKLOG: "Backlog",
  WISHLIST: "Deseado",
  PLAYING: "Jugando",
  COMPLETED: "Completado",
  DROPPED: "Abandonado",
  ON_HOLD: "En pausa",
};

export default function GameCard({ game, onLogSession }: GameCardProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleItems = expanded ? game.libraryItems : game.libraryItems.slice(0, 2);
  const hasMore = game.libraryItems.length > 2;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-sm transition hover:shadow-lg hover:border-slate-700">
      <div className="relative aspect-[3/4] w-full bg-slate-800">
        {game.coverUrl ? (
          <Image
            src={game.coverUrl}
            alt={`Caratula de ${game.title}`}
            fill
            sizes="(max-width: 768px) 50vw, 220px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-500 text-sm px-4 text-center">
            Sin caratula
          </div>
        )}

        <div className="absolute top-2 right-2 rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium text-slate-100 backdrop-blur">
          {game.grandTotalHours.toLocaleString("es-ES")}h totales
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="line-clamp-2 text-base font-semibold text-slate-50">
            {game.title}
          </h3>
          {game.genres && game.genres.length > 0 && (
            <p className="mt-0.5 text-xs text-slate-400">
              {game.genres.slice(0, 3).join(" \u00b7 ")}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-slate-800 bg-slate-950/50 p-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-slate-200">
                  {item.platform}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[item.status]}`}
                >
                  {STATUS_LABELS[item.status]}
                </span>
              </div>

              <div className="mt-2">
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="bg-slate-500"
                    style={{
                      width: `${
                        item.totalHours > 0
                          ? (item.historicalHours / item.totalHours) * 100
                          : 0
                      }%`,
                    }}
                    title={`Historico: ${item.historicalHours}h`}
                  />
                  <div
                    className="bg-emerald-400"
                    style={{
                      width: `${
                        item.totalHours > 0
                          ? (item.sessionHours / item.totalHours) * 100
                          : 0
                      }%`,
                    }}
                    title={`Sesiones: ${item.sessionHours}h`}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                    Historico: {item.historicalHours}h
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Sesiones: {item.sessionHours}h
                  </span>
                </div>
              </div>

              {onLogSession && (
                <button
                  type="button"
                  onClick={() => onLogSession(item)}
                  className="mt-2 w-full rounded-md bg-slate-800 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
                >
                  Registrar sesion
                </button>
              )}
            </div>
          ))}

          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-left text-xs font-medium text-slate-400 hover:text-slate-200"
            >
              {expanded
                ? "Ver menos"
                : `+${game.libraryItems.length - 2} plataforma(s) mas`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
