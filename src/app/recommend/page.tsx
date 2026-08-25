// app/recommend/page.tsx
"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import AddSessionModal from "@/components/AddSessionModal";

interface RecommendedLibraryItem {
  id: string;
  title: string;
  coverUrl: string | null;
  genres: string[] | null;
  platform: string;
  status: string;
  historicalHours: number;
  sessionHours: number;
  totalHours: number;
  averageHoursToBeat: number | null;
}

interface RecommendationResult {
  recommendedLibraryItemId: string;
  gameTitle: string;
  reason: string;
  confidence: "low" | "medium" | "high";
}

interface RecommendResponse {
  recommendation: RecommendationResult;
  libraryItem: RecommendedLibraryItem;
  freeMinutes: number;
  error?: string;
}

const LOADING_MESSAGES = [
  "Analizando tu backlog...",
  "Comparando tus horas historicas por genero...",
  "Revisando tus sesiones de la ultima semana...",
  "Consultando al modelo de IA...",
  "Elaborando el motivo de la recomendacion...",
];

const CONFIDENCE_STYLES: Record<RecommendationResult["confidence"], string> = {
  high: "bg-emerald-600/80 text-emerald-50",
  medium: "bg-amber-600/80 text-amber-50",
  low: "bg-slate-700 text-slate-200",
};

const CONFIDENCE_LABELS: Record<RecommendationResult["confidence"], string> = {
  high: "Alta confianza",
  medium: "Confianza media",
  low: "Baja confianza",
};

const QUICK_TIME_OPTIONS = [20, 40, 60, 120];

export default function RecommendPage() {
  const [freeMinutes, setFreeMinutes] = useState<string>("40");
  const [userId, setUserId] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);

  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isLoading) {
      setLoadingMessageIndex(0);
      loadingIntervalRef.current = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 1400);
    } else if (loadingIntervalRef.current) {
      clearInterval(loadingIntervalRef.current);
    }

    return () => {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    };
  }, [isLoading]);

  const handleRecommend = async () => {
    setError(null);
    setResult(null);

    const minutes = Number(freeMinutes);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      setError("Introduce un numero entero de minutos mayor que 0.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freeMinutes: minutes,
          userId: userId.trim() || undefined,
        }),
      });

      const data: RecommendResponse = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo generar la recomendacion.");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-50">Recomendador IA</h1>
        <p className="mt-1 text-sm text-slate-400">
          Dile a BacklogTracker cuanto tiempo tienes hoy y te recomendara algo
          de tu propio backlog.
        </p>
      </header>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <label
          htmlFor="freeMinutes"
          className="mb-2 block text-sm font-medium text-slate-300"
        >
          ¿Cuanto tiempo libre tienes ahora?
        </label>

        <div className="mb-3 flex flex-wrap gap-2">
          {QUICK_TIME_OPTIONS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => setFreeMinutes(String(minutes))}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                freeMinutes === String(minutes)
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {minutes} min
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            id="freeMinutes"
            type="number"
            min={1}
            step={1}
            value={freeMinutes}
            onChange={(e) => setFreeMinutes(e.target.value)}
            className="w-32 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
          />
          <span className="text-sm text-slate-400">minutos</span>

          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="userId (opcional)"
            className="w-48 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
          />

          <button
            type="button"
            onClick={handleRecommend}
            disabled={isLoading}
            className="ml-auto rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Pensando..." : "Recomiendame algo"}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-800 bg-slate-900 p-10">
          <div className="relative h-14 w-14">
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-500" />
            <div className="absolute inset-0 flex items-center justify-center text-xl">
              🎮
            </div>
          </div>
          <p className="animate-pulse text-sm font-medium text-slate-300">
            {LOADING_MESSAGES[loadingMessageIndex]}
          </p>
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {result && !isLoading && (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <div className="flex flex-col gap-5 p-6 sm:flex-row">
            <div className="relative mx-auto h-56 w-40 shrink-0 overflow-hidden rounded-lg bg-slate-800 sm:mx-0">
              {result.libraryItem.coverUrl ? (
                <Image
                  src={result.libraryItem.coverUrl}
                  alt={`Caratula de ${result.libraryItem.title}`}
                  fill
                  sizes="160px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                  Sin caratula
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-50">
                  {result.libraryItem.title}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    CONFIDENCE_STYLES[result.recommendation.confidence]
                  }`}
                >
                  {CONFIDENCE_LABELS[result.recommendation.confidence]}
                </span>
              </div>

              <p className="text-sm text-slate-400">
                {result.libraryItem.platform}
                {result.libraryItem.genres && result.libraryItem.genres.length > 0
                  ? ` \u00b7 ${result.libraryItem.genres.slice(0, 3).join(", ")}`
                  : ""}
              </p>

              <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                  Por que te lo recomienda la IA
                </p>
                <p className="mt-1 text-sm text-slate-200">
                  {result.recommendation.reason}
                </p>
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                <span>Historico: {result.libraryItem.historicalHours}h</span>
                <span>Sesiones: {result.libraryItem.sessionHours}h</span>
                <span>Total: {result.libraryItem.totalHours}h</span>
                {result.libraryItem.averageHoursToBeat && (
                  <span>
                    Duracion media: {result.libraryItem.averageHoursToBeat}h
                  </span>
                )}
                <span>Tiempo libre indicado: {result.freeMinutes} min</span>
              </div>

              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowSessionModal(true)}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
                >
                  Voy a jugarlo ahora
                </button>
                <button
                  type="button"
                  onClick={handleRecommend}
                  className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
                >
                  Pedir otra recomendacion
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {result && showSessionModal && (
        <AddSessionModal
          isOpen
          onClose={() => setShowSessionModal(false)}
          libraryItemId={result.libraryItem.id}
          gameTitle={result.libraryItem.title}
          platformName={result.libraryItem.platform}
          onSuccess={() => setShowSessionModal(false)}
        />
      )}
    </div>
  );
}
