import {
  Clock,
  Star,
  Code,
  Sparkles,
  Terminal,
  StickyNote,
  File,
  Image as ImageIcon,
  Link as LinkIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { mockItems } from '@/lib/mock-data';

const TYPE_MAP: Record<string, { icon: LucideIcon; color: string }> = {
  type_1: { icon: Code, color: '#3b82f6' },
  type_2: { icon: Sparkles, color: '#8b5cf6' },
  type_3: { icon: Terminal, color: '#f97316' },
  type_4: { icon: StickyNote, color: '#fde047' },
  type_5: { icon: File, color: '#6b7280' },
  type_6: { icon: ImageIcon, color: '#ec4899' },
  type_7: { icon: LinkIcon, color: '#10b981' },
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function RecentItems() {
  const recentItems = [...mockItems]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10);

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Clock className="size-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Recent Items</h2>
      </div>
      <div className="flex flex-col gap-2">
        {recentItems.map((item) => {
          const type = TYPE_MAP[item.itemTypeId] ?? { icon: Code, color: '#6b7280' };
          const { icon: Icon, color } = type;

          return (
            <div
              key={item.id}
              className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/10 transition-colors"
            >
              <div
                className="size-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${color}22` }}
              >
                <Icon className="size-3.5" style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">{item.title}</span>
                  {item.isFavorite && (
                    <Star className="size-3 text-yellow-400 shrink-0" fill="currentColor" />
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {item.tags.length > 0 && (
                  <div className="hidden sm:flex items-center gap-1">
                    {item.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}