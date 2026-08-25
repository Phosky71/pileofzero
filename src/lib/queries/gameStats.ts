import { prisma } from "@/lib/prisma";

export async function getTotalCombinedHours(globalGameId: string) {
  const libraryItems = await prisma.libraryItem.findMany({
    where: { globalGameId },
    select: {
      id: true,
      historicalHours: true,
      platform: { select: { name: true } },
      sessions: { select: { durationMinutes: true } },
    },
  });

  const breakdown = libraryItems.map((item) => {
    const sessionMinutes = item.sessions.reduce(
      (sum, s) => sum + s.durationMinutes,
      0
    );
    return {
      platform: item.platform.name,
      historicalHours: item.historicalHours,
      sessionHours: sessionMinutes / 60,
      totalHours: item.historicalHours + sessionMinutes / 60,
    };
  });

  const grandTotalHours = breakdown.reduce((sum, b) => sum + b.totalHours, 0);

  return { grandTotalHours, breakdown };
}
