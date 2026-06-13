import Link from 'next/link';
import { Star, MoreHorizontal, Code, Sparkles, Terminal } from 'lucide-react';
import { mockCollections } from '@/lib/mock-data';

const PREVIEW_ICONS = [
  { icon: Code, color: '#3b82f6' },
  { icon: Sparkles, color: '#8b5cf6' },
  { icon: Terminal, color: '#f97316' },
];

export default function RecentCollections() {
  const sorted = [...mockCollections].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  );

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Collections</h2>
        <Link
          href="/collections"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          View all
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map((collection) => (
          <div
            key={collection.id}
            className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2 group cursor-pointer hover:bg-muted/10 transition-colors"
          >
            <div className="flex items-start gap-2">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">{collection.name}</h3>
                {collection.isFavorite && (
                  <Star className="size-3.5 text-yellow-400 shrink-0" fill="currentColor" />
                )}
              </div>
              <button className="p-1 rounded hover:bg-muted/50 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <MoreHorizontal className="size-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{collection.itemCount} items</p>
            <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{collection.description}</p>
            <div className="flex items-center gap-1.5 pt-1">
              {PREVIEW_ICONS.map(({ icon: Icon, color }, i) => (
                <Icon key={i} className="size-3.5" style={{ color }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}