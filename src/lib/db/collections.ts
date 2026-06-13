import { prisma } from "@/lib/prisma";

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
