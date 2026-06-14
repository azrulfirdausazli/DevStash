import { getCurrentUserId } from "@/lib/db/user";
import {
  getDashboardCollections,
  getDashboardCollectionStats,
} from "@/lib/db/collections";
import {
  getDashboardPinnedItems,
  getDashboardRecentItems,
  getDashboardItemStats,
} from "@/lib/db/items";
import StatsCards from "@/components/dashboard/StatsCards";
import RecentCollections from "@/components/dashboard/RecentCollections";
import PinnedItems from "@/components/dashboard/PinnedItems";
import RecentItems from "@/components/dashboard/RecentItems";

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  const [collections, collStats, itemStats, pinnedItems, recentItems] = await Promise.all([
    getDashboardCollections(userId),
    getDashboardCollectionStats(userId),
    getDashboardItemStats(userId),
    getDashboardPinnedItems(userId),
    getDashboardRecentItems(userId),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Your developer knowledge hub</p>
      </div>
      <StatsCards
        itemCount={itemStats.itemCount}
        collectionCount={collStats.collectionCount}
        favoriteItemCount={itemStats.favoriteItemCount}
        favoriteCollectionCount={collStats.favoriteCollectionCount}
      />
      <RecentCollections collections={collections} />
      <PinnedItems items={pinnedItems} />
      <RecentItems items={recentItems} />
    </div>
  );
}
