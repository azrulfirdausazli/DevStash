import TopBar from '@/components/dashboard/TopBar';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { getCurrentUserId } from '@/lib/db/user';
import { getSidebarCollections } from '@/lib/db/collections';
import { getSidebarItemTypes } from '@/lib/db/item-types';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
      >
        {children}
      </DashboardShell>
    </div>
  );
}
