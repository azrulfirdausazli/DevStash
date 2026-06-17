import { prisma } from "@/lib/prisma";

export type ProfileData = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  createdAt: Date;
  hasPassword: boolean;
};

export type ItemTypeBreakdownRow = {
  typeId: string;
  name: string;
  icon: string;
  color: string;
  count: number;
};

export type ProfileStats = {
  itemCount: number;
  collectionCount: number;
  breakdown: ItemTypeBreakdownRow[];
};

export async function getProfileData(userId: string): Promise<ProfileData> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      createdAt: true,
      password: true,
    },
  });
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    createdAt: user.createdAt,
    hasPassword: user.password !== null,
  };
}

export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const [itemCount, collectionCount, grouped, systemTypes] = await Promise.all([
    prisma.item.count({ where: { userId } }),
    prisma.collection.count({ where: { userId } }),
    prisma.item.groupBy({
      by: ["itemTypeId"],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.itemType.findMany({
      where: { isSystem: true },
      select: { id: true, name: true, icon: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const countByTypeId = new Map<string, number>();
  for (const row of grouped) {
    countByTypeId.set(row.itemTypeId, row._count._all);
  }

  const breakdown: ItemTypeBreakdownRow[] = systemTypes.map((t) => ({
    typeId: t.id,
    name: t.name,
    icon: t.icon,
    color: t.color,
    count: countByTypeId.get(t.id) ?? 0,
  }));

  return { itemCount, collectionCount, breakdown };
}
