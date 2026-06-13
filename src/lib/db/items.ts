import { prisma } from "@/lib/prisma";

export type DashboardItemType = {
  name: string;
  icon: string;
  color: string;
};

export type DashboardItem = {
  id: string;
  title: string;
  description: string | null;
  isFavorite: boolean;
  isPinned: boolean;
  language: string | null;
  createdAt: Date;
  itemType: DashboardItemType;
  tags: { name: string }[];
};

export async function getDashboardPinnedItems(
  userId: string,
): Promise<DashboardItem[]> {
  return prisma.item.findMany({
    where: { userId, isPinned: true },
    orderBy: { createdAt: "desc" },
    include: {
      itemType: { select: { name: true, icon: true, color: true } },
      tags: { select: { name: true } },
    },
  });
}

export async function getDashboardRecentItems(
  userId: string,
): Promise<DashboardItem[]> {
  return prisma.item.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      itemType: { select: { name: true, icon: true, color: true } },
      tags: { select: { name: true } },
    },
  });
}
