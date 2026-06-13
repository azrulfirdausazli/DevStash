import { mockCollections, mockItems } from '@/lib/mock-data';
import StatsCards from '@/components/dashboard/StatsCards';
import RecentCollections from '@/components/dashboard/RecentCollections';
import PinnedItems from '@/components/dashboard/PinnedItems';
import RecentItems from '@/components/dashboard/RecentItems';

export default function DashboardPage() {
  const favoriteItemCount = mockItems.filter((i) => i.isFavorite).length;
  const favoriteCollectionCount = mockCollections.filter((c) => c.isFavorite).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Your developer knowledge hub</p>
      </div>
      <StatsCards
        itemCount={mockItems.length}
        collectionCount={mockCollections.length}
        favoriteItemCount={favoriteItemCount}
        favoriteCollectionCount={favoriteCollectionCount}
      />
      <RecentCollections />
      <PinnedItems />
      <RecentItems />
    </div>
  );
}