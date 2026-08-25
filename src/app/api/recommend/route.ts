// app/api/recommend/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getGameRecommendation } from "@/services/aiService";

const recommendSchema = z.object({
  freeMinutes: z
    .number()
    .int("freeMinutes debe ser un numero entero de minutos.")
    .positive("freeMinutes debe ser mayor que 0.")
    .max(1440, "freeMinutes no puede superar las 24 horas (1440 minutos)."),
  userId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = recommendSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Payload invalido.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { freeMinutes, userId } = parsed.data;

    let recommendation;
    try {
      recommendation = await getGameRecommendation(userId ?? null, freeMinutes);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido.";

      if (message.includes("No hay candidatos")) {
        return NextResponse.json({ error: message }, { status: 404 });
      }

      console.error("[POST /api/recommend] fallo del motor de IA:", err);
      return NextResponse.json(
        { error: `El motor de recomendaciones fallo: ${message}` },
        { status: 502 }
      );
    }

    const libraryItem = await prisma.libraryItem.findUnique({
      where: { id: recommendation.recommendedLibraryItemId },
      include: {
        globalGame: true,
        platform: true,
        sessions: {
          select: { durationMinutes: true },
        },
      },
    });

    if (!libraryItem) {
      return NextResponse.json(
        {
          error:
            "La IA recomendo un juego que no se encontro en la biblioteca. Intentalo de nuevo.",
          rawRecommendation: recommendation,
        },
        { status: 502 }
      );
    }

    const sessionMinutes = libraryItem.sessions.reduce(
      (sum, s) => sum + s.durationMinutes,
      0
    );

    return NextResponse.json({
      recommendation,
      libraryItem: {
        id: libraryItem.id,
        title: libraryItem.globalGame.title,
        coverUrl: libraryItem.globalGame.coverUrl,
        genres: libraryItem.globalGame.genres,
        platform: libraryItem.platform.name,
        status: libraryItem.status,
        historicalHours: libraryItem.historicalHours,
        sessionHours: Math.round((sessionMinutes / 60) * 100) / 100,
        totalHours:
          Math.round((libraryItem.historicalHours + sessionMinutes / 60) * 100) / 100,
        averageHoursToBeat: libraryItem.globalGame.averageHoursToBeat,
      },
      freeMinutes,
    });
  } catch (err) {
    console.error("[POST /api/recommend]", err);
    return NextResponse.json(
      { error: "Error interno al generar la recomendacion." },
      { status: 500 }
    );
  }
}
