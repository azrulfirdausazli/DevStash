import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getIcon } from "@/lib/db/icons";
import type { ProfileStats } from "@/lib/db/profile";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default function ProfileStats({ stats }: { stats: ProfileStats }) {
  const maxCount = Math.max(...stats.breakdown.map((b) => b.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Items" value={stats.itemCount} />
          <StatCard label="Collections" value={stats.collectionCount} />
        </div>

        <div>
          <h3 className="text-sm font-medium mb-3">Items by type</h3>
          <ul className="space-y-2">
            {stats.breakdown.map((row) => {
              const Icon = getIcon(row.icon);
              const pct = (row.count / maxCount) * 100;
              return (
                <li key={row.typeId} className="flex items-center gap-3 text-sm">
                  <Icon className="size-4 shrink-0" style={{ color: row.color }} />
                  <span className="w-24 shrink-0 capitalize">{row.name}s</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: row.color }}
                    />
                  </div>
                  <span className="w-8 text-right tabular-nums text-muted-foreground">
                    {row.count}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
