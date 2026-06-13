import {
  Pin,
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

export default function PinnedItems() {
  const pinnedItems = mockItems.filter((item) => item.isPinned);

  if (pinnedItems.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Pin className="size-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Pinned</h2>
      </div>
      <div className="flex flex-col gap-3">
        {pinnedItems.map((item) => {
          const type = TYPE_MAP[item.itemTypeId] ?? { icon: Code, color: '#6b7280' };
          const { icon: Icon, color } = type;

          return (
            <div
              key={item.id}
              className="bg-card border border-border rounded-xl p-4 flex items-start gap-4 cursor-pointer hover:bg-muted/10 transition-colors"
            >
              <div
                className="size-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${color}22` }}
              >
                <Icon className="size-4" style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="font-medium text-sm truncate">{item.title}</span>
                  {item.isFavorite && (
                    <Star className="size-3.5 text-yellow-400 shrink-0" fill="currentColor" />
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{item.description}</p>
                )}
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground shrink-0 mt-0.5">{formatDate(item.createdAt)}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}