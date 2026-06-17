import TopBar from '@/components/dashboard/TopBar';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { getCurrentUserId } from '@/lib/db/user';
import { getSidebarCollections } from '@/lib/db/collections';
import { getSidebarItemTypes } from '@/lib/db/item-types';
import { auth } from "@/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = {
    name: session?.user?.name ?? "User",
    email: session?.user?.email ?? "",
    image: session?.user?.image ?? null,
  };

  const userId = await getCurrentUserId();
  const [sidebarItemTypes, sidebarCollections] = await Promise.all([
    getSidebarItemTypes(),
    getSidebarCollections(userId),
  ]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar />
      <DashboardShell
        sidebarItemTypes={sidebarItemTypes}
        sidebarCollections={sidebarCollections}
        user={user}
      >
        {children}
      </DashboardShell>
    </div>
  );
}
