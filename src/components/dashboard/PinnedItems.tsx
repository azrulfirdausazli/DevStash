import { Pin, Star } from "lucide-react";
import type { DashboardItem } from "@/lib/db/items";
import { getIcon } from "@/lib/db/icons";
import { formatDate } from "@/lib/utils";

export default function PinnedItems({ items }: { items: DashboardItem[] }) {
  if (items.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Pin className="size-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Pinned</h2>
      </div>
      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const { itemType } = item;
          const Icon = getIcon(itemType.icon);
          return (
            <div
              key={item.id}
              className="bg-card border border-border rounded-xl p-4 flex items-start gap-4 cursor-pointer hover:bg-muted/10 transition-colors"
            >
              <div
                className="size-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${itemType.color}22` }}
              >
                <Icon className="size-4" style={{ color: itemType.color }} />
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
                    {item.tags.map((t) => (
                      <span
                        key={t.name}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                      >
                        {t.name}
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
