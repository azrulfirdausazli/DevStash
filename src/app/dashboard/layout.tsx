import TopBar from '@/components/dashboard/TopBar';
import DashboardShell from '@/components/dashboard/DashboardShell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar />
      <DashboardShell>{children}</DashboardShell>
    </div>
  );
}