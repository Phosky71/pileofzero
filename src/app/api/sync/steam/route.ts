// app/api/sync/steam/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { syncSteamLibrary } from "@/services/steamSync";

const syncSteamSchema = z.object({
  userId: z.string().min(1, "userId es obligatorio."),
  steamId: z
    .string()
    .regex(/^\d{17}$/, "steamId debe ser un SteamID64 valido (17 digitos).")
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = syncSteamSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Payload invalido.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { userId, steamId } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json(
        { error: `No existe ningun usuario con id "${userId}".` },
        { status: 404 }
      );
    }

    const effectiveSteamId = steamId ?? user.steamId;
    if (!effectiveSteamId) {
      return NextResponse.json(
        {
          error:
            "El usuario no tiene un steamId asociado. Proporcionalo en el body de la peticion.",
        },
        { status: 400 }
      );
    }

    if (steamId && steamId !== user.steamId) {
      await prisma.user.update({
        where: { id: userId },
        data: { steamId },
      });
    }

    if (!process.env.STEAM_API_KEY) {
      return NextResponse.json(
        { error: "STEAM_API_KEY no esta configurada en el entorno del servidor." },
        { status: 500 }
      );
    }

    const startedAt = Date.now();
    const results = await syncSteamLibrary(userId, effectiveSteamId);
    const durationMs = Date.now() - startedAt;

    return NextResponse.json({
      message: "Sincronizacion con Steam completada.",
      steamId: effectiveSteamId,
      durationMs,
      results,
    });
  } catch (err) {
    console.error("[POST /api/sync/steam]", err);
    const message =
      err instanceof Error ? err.message : "Error desconocido durante la sincronizacion.";
    return NextResponse.json(
      { error: `Error al sincronizar con Steam: ${message}` },
      { status: 500 }
    );
  }
}
