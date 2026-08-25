"use client";

import { useState, type FormEvent } from "react";

interface AddSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  libraryItemId: string;
  gameTitle: string;
  platformName: string;
  onSuccess?: (session: { id: string; durationMinutes: number }) => void;
}

export default function AddSessionModal({
  isOpen,
  onClose,
  libraryItemId,
  gameTitle,
  platformName,
  onSuccess,
}: AddSessionModalProps) {
  const [durationMinutes, setDurationMinutes] = useState<string>("30");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetAndClose = () => {
    setDurationMinutes("30");
    setNotes("");
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const minutes = Number(durationMinutes);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      setError("Introduce un numero entero de minutos mayor que 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          libraryItemId,
          durationMinutes: minutes,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo registrar la sesion.");
      }

      onSuccess?.(data.session);
      resetAndClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickOptions = [15, 30, 60, 120];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={resetAndClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-50">Registrar sesion</h2>
          <p className="mt-0.5 text-sm text-slate-400">
            {gameTitle} <span className="text-slate-500">\u00b7 {platformName}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="durationMinutes"
              className="mb-1.5 block text-sm font-medium text-slate-300"
            >
              ¿Cuanto tiempo has jugado?
            </label>

            <div className="mb-2 flex gap-2">
              {quickOptions.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => setDurationMinutes(String(minutes))}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    durationMinutes === String(minutes)
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {minutes}m
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                id="durationMinutes"
                type="number"
                min={1}
                step={1}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
                placeholder="Minutos"
                required
              />
              <span className="text-sm text-slate-400">minutos</span>
            </div>
          </div>

          <div>
            <label
              htmlFor="notes"
              className="mb-1.5 block text-sm font-medium text-slate-300"
            >
              Notas (opcional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={1000}
              className="w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
              placeholder="Ej: llegue al segundo boss..."
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-950/50 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={resetAndClose}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Guardando..." : "Guardar sesion"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
