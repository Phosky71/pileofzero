// src/services/steamSync.ts
// Servicio core para sincronizar la biblioteca de Steam del usuario.
// Referencia: IPlayerService/GetOwnedGames/v1 (Steam Web API)

import { prisma } from "@/lib/prisma";
import { findOrCreateGlobalGameByName } from "@/services/igdbService";
import { PlatformType } from "@prisma/client";

const STEAM_API_BASE = "https://api.steampowered.com";

interface SteamOwnedGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url?: string;
}

interface SteamOwnedGamesResponse {
  response: {
    game_count?: number;
    games?: SteamOwnedGame[];
  };
}

async function fetchOwnedGames(steamId: string): Promise<SteamOwnedGame[]> {
  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) throw new Error("STEAM_API_KEY no configurada en el entorno.");

  const url = new URL(`${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("steamid", steamId);
  url.searchParams.set("include_appinfo", "true");
  url.searchParams.set("include_played_free_games", "true");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Steam API respondio ${res.status}: ${res.statusText}`);
  }

  const data: SteamOwnedGamesResponse = await res.json();
  return data.response.games ?? [];
}

async function getOrCreateSteamPlatform() {
  return prisma.platform.upsert({
    where: { name: "Steam" },
    update: {},
    create: { name: "Steam", type: PlatformType.PC },
  });
}

/**
 * Sincroniza la biblioteca completa de Steam para un usuario.
 * REGLA CLAVE: en la primera sincronizacion, las horas totales reportadas
 * por Steam se guardan integramente como `historicalHours`. No se generan
 * `Session`s a partir de este volcado, para no envenenar el contexto de la IA
 * con "interes actual" que en realidad es historico acumulado de anios.
 */
export async function syncSteamLibrary(userId: string, steamId: string) {
  const [games, steamPlatform] = await Promise.all([
    fetchOwnedGames(steamId),
    getOrCreateSteamPlatform(),
  ]);

  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [] as string[],
  };

  for (const game of games) {
    try {
      const hoursPlayed = game.playtime_forever / 60;

      const globalGame = await findOrCreateGlobalGameByName(game.name);

      const existing = await prisma.libraryItem.findUnique({
        where: { steamAppId: game.appid },
      });

      if (existing) {
        if (hoursPlayed > existing.historicalHours) {
          await prisma.libraryItem.update({
            where: { id: existing.id },
            data: {
              historicalHours: hoursPlayed,
              localTitle: game.name,
              updatedAt: new Date(),
            },
          });
          results.updated++;
        } else {
          results.skipped++;
        }
        continue;
      }

      await prisma.libraryItem.create({
        data: {
          userId,
          globalGameId: globalGame.id,
          platformId: steamPlatform.id,
          localTitle: game.name,
          steamAppId: game.appid,
          historicalHours: hoursPlayed,
          status: hoursPlayed > 0 ? "PLAYING" : "BACKLOG",
          cost: 0,
        },
      });
      results.created++;
    } catch (err) {
      results.errors.push(
        `${game.name} (appid ${game.appid}): ${(err as Error).message}`
      );
    }
  }

  return results;
}
