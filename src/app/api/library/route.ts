// app/api/library/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { findOrCreateGlobalGameByName } from "@/services/igdbService";
import { LibraryStatus, PlatformType } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");

    if (statusFilter && !Object.values(LibraryStatus).includes(statusFilter as LibraryStatus)) {
      return NextResponse.json(
        {
          error: `Estado invalido: "${statusFilter}". Valores permitidos: ${Object.values(
            LibraryStatus
          ).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const globalGames = await prisma.globalGame.findMany({
      where: statusFilter
        ? {
            libraryItems: {
              some: { status: statusFilter as LibraryStatus },
            },
          }
        : undefined,
      include: {
        libraryItems: {
          where: statusFilter ? { status: statusFilter as LibraryStatus } : undefined,
          include: {
            platform: true,
            sessions: {
              select: { id: true, durationMinutes: true, playedAt: true },
            },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
      orderBy: { title: "asc" },
    });

    const enriched = globalGames.map((game) => {
      const libraryItems = game.libraryItems.map((item) => {
        const sessionMinutes = item.sessions.reduce(
          (sum, s) => sum + s.durationMinutes,
          0
        );
        return {
          id: item.id,
          localTitle: item.localTitle,
          status: item.status,
          cost: item.cost,
          currency: item.currency,
          steamAppId: item.steamAppId,
          historicalHours: item.historicalHours,
          sessionHours: Math.round((sessionMinutes / 60) * 100) / 100,
          totalHours:
            Math.round((item.historicalHours + sessionMinutes / 60) * 100) / 100,
          platform: item.platform.name,
          platformType: item.platform.type,
          lastPlayedAt: item.lastPlayedAt,
          addedAt: item.addedAt,
        };
      });

      const grandTotalHours = libraryItems.reduce(
        (sum, item) => sum + item.totalHours,
        0
      );

      return {
        id: game.id,
        igdbId: game.igdbId,
        globalSlug: game.globalSlug,
        title: game.title,
        coverUrl: game.coverUrl,
        genres: game.genres,
        averageHoursToBeat: game.averageHoursToBeat,
        grandTotalHours: Math.round(grandTotalHours * 100) / 100,
        platformCount: libraryItems.length,
        libraryItems,
      };
    });

    return NextResponse.json({ games: enriched, count: enriched.length });
  } catch (err) {
    console.error("[GET /api/library]", err);
    return NextResponse.json(
      { error: "Error al obtener la biblioteca." },
      { status: 500 }
    );
  }
}

const createLibraryItemSchema = z.object({
  title: z.string().min(1, "El titulo es obligatorio."),
  platformName: z.string().min(1, "La plataforma es obligatoria."),
  platformType: z.nativeEnum(PlatformType).optional().default(PlatformType.PC),
  status: z.nativeEnum(LibraryStatus).optional().default(LibraryStatus.BACKLOG),
  cost: z.number().min(0).optional().default(0),
  currency: z.string().optional().default("EUR"),
  historicalHours: z.number().min(0).optional().default(0),
  userId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createLibraryItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Payload invalido.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      title,
      platformName,
      platformType,
      status,
      cost,
      currency,
      historicalHours,
      userId,
    } = parsed.data;

    const globalGame = await findOrCreateGlobalGameByName(title);

    const platform = await prisma.platform.upsert({
      where: { name: platformName },
      update: {},
      create: { name: platformName, type: platformType },
    });

    const existing = await prisma.libraryItem.findFirst({
      where: {
        globalGameId: globalGame.id,
        platformId: platform.id,
        userId: userId ?? null,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: `"${title}" ya existe en tu biblioteca para la plataforma "${platformName}".`,
          existingLibraryItemId: existing.id,
        },
        { status: 409 }
      );
    }

    const libraryItem = await prisma.libraryItem.create({
      data: {
        userId,
        globalGameId: globalGame.id,
        platformId: platform.id,
        localTitle: title,
        status,
        cost,
        currency,
        historicalHours,
      },
      include: { globalGame: true, platform: true },
    });

    return NextResponse.json({ libraryItem }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/library]", err);
    return NextResponse.json(
      { error: "Error al crear el registro de biblioteca." },
      { status: 500 }
    );
  }
}
