import { prisma } from "@/lib/prisma";

export type SidebarItemType = {
  name: string;
  icon: string;
  color: string;
};

export async function getSidebarItemTypes(): Promise<SidebarItemType[]> {
  return prisma.itemType.findMany({
    where: { isSystem: true },
    orderBy: { name: "asc" },
    select: { name: true, icon: true, color: true },
  });
}
