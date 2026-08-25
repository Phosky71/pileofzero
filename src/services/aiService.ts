// src/services/aiService.ts
// Motor de recomendaciones agnostico: router para LLMs locales (Ollama, LM Studio)
// o cloud (OpenAI, Groq, Claude, Gemini), + builder de contexto inteligente.

import { prisma } from "@/lib/prisma";

type LlmProvider = "ollama" | "lmstudio" | "openai" | "groq" | "claude" | "gemini";

interface RecommendationResult {
  recommendedLibraryItemId: string;
  gameTitle: string;
  reason: string;
  confidence: "low" | "medium" | "high";
}

interface GenreHours {
  genre: string;
  hours: number;
}

async function buildRawContext(userId: string | null, freeMinutesToday: number) {
  const libraryItems = await prisma.libraryItem.findMany({
    where: { userId: userId ?? undefined },
    include: {
      globalGame: true,
      platform: true,
      sessions: {
        where: {
          playedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      },
    },
  });

  const historicalByGenre = new Map<string, number>();
  const recentByGenre = new Map<string, number>();

  for (const item of libraryItems) {
    const genres = (item.globalGame.genres as string[] | null) ?? ["Sin genero"];
    const recentMinutes = item.sessions.reduce((sum, s) => sum + s.durationMinutes, 0);

    for (const genre of genres) {
      historicalByGenre.set(
        genre,
        (historicalByGenre.get(genre) ?? 0) + item.historicalHours
      );
      recentByGenre.set(genre, (recentByGenre.get(genre) ?? 0) + recentMinutes / 60);
    }
  }

  const backlogCandidates = libraryItems.filter(
    (item) =>
      item.status === "BACKLOG" ||
      (item.status === "PLAYING" &&
        item.historicalHours + item.sessions.length === 0)
  );

  return {
    historicalPreferences: Array.from(historicalByGenre.entries()).map(
      ([genre, hours]) => ({ genre, hours: Math.round(hours) } as GenreHours)
    ),
    recentActivity: Array.from(recentByGenre.entries()).map(
      ([genre, hours]) => ({ genre, hours: Math.round(hours * 10) / 10 } as GenreHours)
    ),
    backlogCandidates: backlogCandidates.map((item) => ({
      libraryItemId: item.id,
      title: item.globalGame.title,
      platform: item.platform.name,
      genres: (item.globalGame.genres as string[] | null) ?? [],
      status: item.status,
      averageHoursToBeat: item.globalGame.averageHoursToBeat,
    })),
    freeMinutesToday,
  };
}

function buildPrompt(context: Awaited<ReturnType<typeof buildRawContext>>): string {
  const historicalStr = context.historicalPreferences
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 5)
    .map((g) => `${g.genre}: ${g.hours}h historicas`)
    .join(", ");

  const recentStr =
    context.recentActivity.length > 0
      ? context.recentActivity
          .sort((a, b) => b.hours - a.hours)
          .slice(0, 5)
          .map((g) => `${g.genre}: ${g.hours}h esta semana`)
          .join(", ")
      : "sin sesiones registradas en los ultimos 7 dias";

  const backlogStr = context.backlogCandidates
    .map(
      (g) =>
        `- id: "${g.libraryItemId}" | "${g.title}" (${g.platform}) | generos: ${g.genres.join(
          ", "
        )} | duracion media: ${g.averageHoursToBeat ?? "desconocida"}h`
    )
    .join("\n");

  return `Eres un motor de recomendaciones de videojuegos para un backlog personal.

DATOS DEL USUARIO:
- Preferencias globales (horas historicas acumuladas por genero, indica gustos de largo plazo): ${historicalStr || "sin datos historicos"}.
- Interes actual (horas jugadas en sesiones reales de la ultima semana, indica el mood actual): ${recentStr}.
- Tiempo libre disponible hoy: ${context.freeMinutesToday} minutos.

IMPORTANTE: Las horas historicas reflejan gustos consolidados pero NO el estado de animo actual. Las horas de "interes actual" son mucho mas relevantes para decidir que recomendar hoy. Si hay conflicto entre ambas, prioriza el interes actual, pero usa las preferencias historicas para filtrar generos afines dentro del backlog.

CANDIDATOS DEL BACKLOG (juegos con 0h jugadas o en estado "jugando" sin progreso):
${backlogStr || "No hay candidatos disponibles en el backlog."}

TAREA: Recomienda exactamente UN juego del backlog listado arriba, teniendo en cuenta el tiempo libre de hoy y el interes actual del usuario.

FORMATO DE SALIDA OBLIGATORIO: responde UNICAMENTE con un objeto JSON valido, sin texto adicional, con esta forma exacta:
{"recommendedLibraryItemId": "<id exacto de la lista>", "gameTitle": "<titulo>", "reason": "<motivo breve, 1-2 frases>", "confidence": "low"|"medium"|"high"}`;
}

async function callLlm(prompt: string): Promise<string> {
  const provider = (process.env.LLM_PROVIDER as LlmProvider) ?? "ollama";

  switch (provider) {
    case "ollama": {
      const res = await fetch(`${process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL ?? "llama3.1",
          messages: [{ role: "user", content: prompt }],
          format: "json",
          stream: false,
        }),
      });
      const data = await res.json();
      return data.message.content;
    }

    case "lmstudio": {
      const res = await fetch(`${process.env.LMSTUDIO_BASE_URL ?? "http://localhost:1234"}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.LMSTUDIO_MODEL ?? "local-model",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        }),
      });
      const data = await res.json();
      return data.choices[0].message.content;
    }

    case "openai":
    case "groq": {
      const baseUrl =
        provider === "groq"
          ? "https://api.groq.com/openai/v1"
          : "https://api.openai.com/v1";
      const apiKey =
        provider === "groq" ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY;

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.LLM_MODEL ?? (provider === "groq" ? "llama-3.3-70b-versatile" : "gpt-4o-mini"),
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        }),
      });
      const data = await res.json();
      return data.choices[0].message.content;
    }

    case "claude": {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env.LLM_MODEL ?? "claude-3-5-sonnet-latest",
          max_tokens: 512,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      return data.content[0].text;
    }

    case "gemini": {
      const model = process.env.LLM_MODEL ?? "gemini-1.5-flash";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );
      const data = await res.json();
      return data.candidates[0].content.parts[0].text;
    }

    default:
      throw new Error(`Proveedor LLM no soportado: ${provider}`);
  }
}

function parseRecommendation(raw: string): RecommendationResult {
  const cleaned = raw.trim().replace(/^```json\s*|```$/g, "");
  const parsed = JSON.parse(cleaned);

  if (
    !parsed.recommendedLibraryItemId ||
    !parsed.gameTitle ||
    !parsed.reason ||
    !parsed.confidence
  ) {
    throw new Error("Respuesta del LLM no cumple el contrato JSON esperado.");
  }

  return parsed as RecommendationResult;
}

export async function getGameRecommendation(
  userId: string | null,
  freeMinutesToday: number
): Promise<RecommendationResult> {
  const context = await buildRawContext(userId, freeMinutesToday);

  if (context.backlogCandidates.length === 0) {
    throw new Error("No hay candidatos en el backlog para recomendar.");
  }

  const prompt = buildPrompt(context);
  const rawResponse = await callLlm(prompt);
  return parseRecommendation(rawResponse);
}
