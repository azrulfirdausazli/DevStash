import { prisma } from "@/lib/prisma";

function computeDominantColor(
  items: { item: { itemType: { color: string } } }[],
): string | null {
  const counts = new Map<string, { color: string; count: number }>();
  for (const { item } of items) {
    const { color } = item.itemType;
    counts.set(color, { color, count: (counts.get(color)?.count ?? 0) + 1 });
  }
  return (
    Array.from(counts.values()).sort((a, b) =>
      b.count !== a.count ? b.count - a.count : a.color.localeCompare(b.color),
    )[0]?.color ?? null
  );
}

export type TypeSummary = {
  name: string;
  icon: string;
  color: string;
  count: number;
};

export type DashboardCollection = {
  id: string;
  name: string;
  description: string | null;
  isFavorite: boolean;
  itemCount: number;
  updatedAt: Date;
  types: TypeSummary[];
  dominantType: TypeSummary | null;
};

export type DashboardCollectionStats = {
  collectionCount: number;
  favoriteCollectionCount: number;
};

export async function getDashboardCollectionStats(
  userId: string,
): Promise<DashboardCollectionStats> {
  const [collectionCount, favoriteCollectionCount] = await Promise.all([
    prisma.collection.count({ where: { userId } }),
    prisma.collection.count({ where: { userId, isFavorite: true } }),
  ]);
  return { collectionCount, favoriteCollectionCount };
}

export async function getDashboardCollections(
  userId: string,
): Promise<DashboardCollection[]> {
  const rows = await prisma.collection.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      items: {
        include: {
          item: {
            select: {
              itemType: { select: { name: true, icon: true, color: true } },
            },
          },
        },
      },
    },
  });

  return rows.map((row) => {
    const typeMap = new Map<string, TypeSummary>();
    for (const { item } of row.items) {
      const { itemType } = item;
      const existing = typeMap.get(itemType.name);
      if (existing) {
        existing.count += 1;
      } else {
        typeMap.set(itemType.name, {
          name: itemType.name,
          icon: itemType.icon,
          color: itemType.color,
          count: 1,
        });
      }
    }
    const types = Array.from(typeMap.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
    const dominantColor = computeDominantColor(row.items);
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      isFavorite: row.isFavorite,
      itemCount: row.items.length,
      updatedAt: row.updatedAt,
      types,
      dominantType: types.find((t) => t.color === dominantColor) ?? null,
    };
  });
}

export type SidebarCollection = {
  id: string;
  name: string;
  isFavorite: boolean;
  dominantTypeColor: string | null;
};

export async function getSidebarCollections(
  userId: string,
): Promise<SidebarCollection[]> {
  const rows = await prisma.collection.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 8,
    include: {
      items: {
        include: {
          item: {
            select: {
              itemType: { select: { color: true } },
            },
          },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    isFavorite: row.isFavorite,
    dominantTypeColor: computeDominantColor(row.items),
  }));
}
