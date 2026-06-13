import { getCurrentUserId } from "@/lib/db/user";
import {
  getDashboardCollections,
  getDashboardCollectionStats,
} from "@/lib/db/collections";
import StatsCards from "@/components/dashboard/StatsCards";
import RecentCollections from "@/components/dashboard/RecentCollections";
import PinnedItems from "@/components/dashboard/PinnedItems";
import RecentItems from "@/components/dashboard/RecentItems";

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  const [collections, collStats] = await Promise.all([
    getDashboardCollections(userId),
    getDashboardCollectionStats(userId),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Your developer knowledge hub</p>
      </div>
      <StatsCards
        itemCount={0}
        collectionCount={collStats.collectionCount}
        favoriteItemCount={0}
        favoriteCollectionCount={collStats.favoriteCollectionCount}
      />
      <RecentCollections collections={collections} />
      <PinnedItems />
      <RecentItems />
    </div>
  );
}
