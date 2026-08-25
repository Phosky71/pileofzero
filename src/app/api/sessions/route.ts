// app/api/sessions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { LibraryStatus } from "@/generated/prisma/client";

const createSessionSchema = z.object({
  libraryItemId: z.string().min(1, "libraryItemId es obligatorio."),
  durationMinutes: z
    .number()
    .int("La duracion debe ser un numero entero de minutos.")
    .positive("La duracion debe ser mayor que 0."),
  playedAt: z
    .string()
    .datetime({ message: "playedAt debe ser una fecha ISO 8601 valida." })
    .optional(),
  notes: z.string().max(1000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createSessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Payload invalido.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { libraryItemId, durationMinutes, playedAt, notes } = parsed.data;

    const libraryItem = await prisma.libraryItem.findUnique({
      where: { id: libraryItemId },
    });

    if (!libraryItem) {
      return NextResponse.json(
        { error: `No existe ningun LibraryItem con id "${libraryItemId}".` },
        { status: 404 }
      );
    }

    const sessionDate = playedAt ? new Date(playedAt) : new Date();

    const [session, updatedItem] = await prisma.$transaction([
      prisma.session.create({
        data: {
          libraryItemId,
          durationMinutes,
          playedAt: sessionDate,
          notes,
        },
      }),
      prisma.libraryItem.update({
        where: { id: libraryItemId },
        data: {
          lastPlayedAt: sessionDate,
          status:
            libraryItem.status === LibraryStatus.BACKLOG ||
            libraryItem.status === LibraryStatus.WISHLIST
              ? LibraryStatus.PLAYING
              : libraryItem.status,
        },
      }),
    ]);

    return NextResponse.json(
      {
        session,
        libraryItem: {
          id: updatedItem.id,
          status: updatedItem.status,
          lastPlayedAt: updatedItem.lastPlayedAt,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/sessions]", err);
    return NextResponse.json(
      { error: "Error al registrar la sesion de juego." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const libraryItemId = searchParams.get("libraryItemId");

    if (!libraryItemId) {
      return NextResponse.json(
        { error: "El query param libraryItemId es obligatorio." },
        { status: 400 }
      );
    }

    const sessions = await prisma.session.findMany({
      where: { libraryItemId },
      orderBy: { playedAt: "desc" },
    });

    return NextResponse.json({ sessions, count: sessions.length });
  } catch (err) {
    console.error("[GET /api/sessions]", err);
    return NextResponse.json(
      { error: "Error al obtener las sesiones." },
      { status: 500 }
    );
  }
}
