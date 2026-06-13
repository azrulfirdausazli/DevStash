import { Package, Layers, Star, BookMarked } from 'lucide-react';

interface StatsCardsProps {
  itemCount: number;
  collectionCount: number;
  favoriteItemCount: number;
  favoriteCollectionCount: number;
}

export default function StatsCards({
  itemCount,
  collectionCount,
  favoriteItemCount,
  favoriteCollectionCount,
}: StatsCardsProps) {
  const stats = [
    { label: 'Items', value: itemCount, icon: Package, color: '#3b82f6' },
    { label: 'Collections', value: collectionCount, icon: Layers, color: '#8b5cf6' },
    { label: 'Favorite Items', value: favoriteItemCount, icon: Star, color: '#f59e0b' },
    { label: 'Favorite Collections', value: favoriteCollectionCount, icon: BookMarked, color: '#10b981' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div
            className="size-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}22` }}
          >
            <Icon className="size-5" style={{ color }} />
          </div>
          <div>
            <p className="text-2xl font-bold leading-tight">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}