// src/services/igdbService.ts
// Servicio de enriquecimiento de metadatos y unificacion de identidad global.
// Auth: Twitch OAuth2 Client Credentials -> App Access Token
// Docs: https://api-docs.igdb.com/

import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import type { GlobalGame } from "@/generated/prisma/client";

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_BASE_URL = "https://api.igdb.com/v4";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAppAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET no configurados.");
  }

  const url = new URL(TWITCH_TOKEN_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("grant_type", "client_credentials");

  const res = await fetch(url.toString(), { method: "POST" });
  if (!res.ok) throw new Error(`Twitch OAuth fallo: ${res.status}`);

  const data = await res.json();
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.value;
}

async function igdbFetch(endpoint: string, body: string) {
  const clientId = process.env.TWITCH_CLIENT_ID!;
  const token = await getAppAccessToken();

  const res = await fetch(`${IGDB_BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`IGDB API (${endpoint}) respondio ${res.status}`);
  }
  return res.json();
}

interface IgdbGameResult {
  id: number;
  name: string;
  slug: string;
  summary?: string;
  cover?: { url: string };
  genres?: { name: string }[];
}

async function searchIgdbByName(name: string): Promise<IgdbGameResult | null> {
  const query = `
    search "${name.replace(/"/g, "")}";
    fields id,name,slug,summary,cover.url,genres.name;
    limit 1;
  `;

  const results: IgdbGameResult[] = await igdbFetch("games", query);
  return results?.[0] ?? null;
}

async function fetchAverageHoursToBeat(igdbId: number): Promise<number | null> {
  const query = `fields normally; where game_id = ${igdbId}; limit 1;`;
  const results = await igdbFetch("game_time_to_beat", query);
  const seconds = results?.[0]?.normally;
  return seconds ? Math.round(seconds / 3600) : null;
}

/**
 * Punto de entrada de unificacion: dado un nombre de juego (proveniente de
 * Steam, un emulador o entrada manual), busca o crea el GlobalGame
 * correspondiente, garantizando que todas las plataformas converjan en
 * el mismo registro cuando el igdbId coincide.
 */
export async function findOrCreateGlobalGameByName(
  rawName: string
): Promise<GlobalGame> {
  const cleanName = rawName.trim();
  const fallbackSlug = slugify(cleanName);

  const existingBySlug = await prisma.globalGame.findUnique({
    where: { globalSlug: fallbackSlug },
  });

  let igdbMatch: IgdbGameResult | null = null;
  try {
    igdbMatch = await searchIgdbByName(cleanName);
  } catch {
    // Si IGDB falla, seguimos con datos locales.
  }

  if (igdbMatch) {
    const byIgdbId = await prisma.globalGame.findUnique({
      where: { igdbId: igdbMatch.id },
    });
    if (byIgdbId) return byIgdbId;

    const avgHours = await fetchAverageHoursToBeat(igdbMatch.id).catch(() => null);

    return prisma.globalGame.upsert({
      where: { globalSlug: igdbMatch.slug },
      update: {
        igdbId: igdbMatch.id,
        title: igdbMatch.name,
        coverUrl: igdbMatch.cover?.url?.replace("t_thumb", "t_cover_big"),
        genres: igdbMatch.genres?.map((g) => g.name) ?? [],
        summary: igdbMatch.summary,
        averageHoursToBeat: avgHours ?? undefined,
      },
      create: {
        igdbId: igdbMatch.id,
        globalSlug: igdbMatch.slug,
        title: igdbMatch.name,
        coverUrl: igdbMatch.cover?.url?.replace("t_thumb", "t_cover_big"),
        genres: igdbMatch.genres?.map((g) => g.name) ?? [],
        summary: igdbMatch.summary,
        averageHoursToBeat: avgHours ?? undefined,
      },
    });
  }

  if (existingBySlug) return existingBySlug;

  return prisma.globalGame.create({
    data: {
      globalSlug: fallbackSlug,
      title: cleanName,
    },
  });
}
