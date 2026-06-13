import { Clock, Star } from "lucide-react";
import type { DashboardItem } from "@/lib/db/items";
import { getIcon } from "@/lib/db/icons";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function RecentItems({ items }: { items: DashboardItem[] }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Clock className="size-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Recent Items</h2>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const { itemType } = item;
          const Icon = getIcon(itemType.icon);
          return (
            <div
              key={item.id}
              className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/10 transition-colors"
            >
              <div
                className="size-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${itemType.color}22` }}
              >
                <Icon className="size-3.5" style={{ color: itemType.color }} />
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
                    {item.tags.slice(0, 2).map((t) => (
                      <span
                        key={t.name}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                      >
                        {t.name}
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
