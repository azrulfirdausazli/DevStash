import Link from 'next/link';
import { Star } from 'lucide-react';
import type { SidebarItemType } from '@/lib/db/item-types';
import type { SidebarCollection } from '@/lib/db/collections';
import { getIcon } from '@/lib/db/icons';
import { Badge } from '@/components/ui/badge';
import UserAvatar from '@/components/auth/UserAvatar';
import { signOutAction } from '@/actions/signout';
import SidebarSection from './SidebarSection';

const PRO_TYPES = new Set(['file', 'image']);

const TYPE_LABELS: Record<string, string> = {
  snippet: 'Snippets',
  prompt: 'Prompts',
  command: 'Commands',
  note: 'Notes',
  file: 'Files',
  image: 'Images',
  link: 'Links',
};

interface SidebarProps {
  collapsed: boolean;
  itemTypes: SidebarItemType[];
  collections: SidebarCollection[];
  user: { name: string; email: string; image: string | null };
}

export default function Sidebar({ collapsed, itemTypes, collections, user }: SidebarProps) {
  const favoriteCollections = collections.filter((c) => c.isFavorite);
  const allCollections = collections.filter((c) => !c.isFavorite);

  return (
    <div className="flex flex-col h-full py-2">
      {/* Types */}
      <div className="px-3">
        {!collapsed ? (
          <SidebarSection label="Types">
            <nav className="space-y-0.5">
              {itemTypes.map((t) => {
                const Icon = getIcon(t.icon);
                const label = TYPE_LABELS[t.name] ?? t.name;
                return (
                  <Link
                    key={t.name}
                    href={`/items/${t.name}s`}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <Icon className="size-4 shrink-0" style={{ color: t.color }} />
                    <span className="flex-1">{label}</span>
                    {PRO_TYPES.has(t.name) && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 leading-none font-semibold tracking-wide text-muted-foreground border-muted-foreground/40">
                        PRO
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </nav>
          </SidebarSection>
        ) : (
          <nav className="space-y-0.5">
            {itemTypes.map((t) => {
              const Icon = getIcon(t.icon);
              return (
                <Link
                  key={t.name}
                  href={`/items/${t.name}s`}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Icon className="size-4 shrink-0" style={{ color: t.color }} />
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      {/* Collections */}
      {!collapsed && (
        <div className="mt-2 px-3 border-t border-border pt-3">
          <SidebarSection label="Collections">
            <p className="px-2 mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Favorites
            </p>
            <nav className="space-y-0.5 mb-3">
              {favoriteCollections.map((c) => (
                <Link
                  key={c.id}
                  href={`/collections/${c.id}`}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-foreground hover:bg-muted/50 transition-colors"
                >
                  <span className="flex-1 truncate">{c.name}</span>
                  <Star
                    className="size-3 text-yellow-400 shrink-0"
                    fill="currentColor"
                  />
                </Link>
              ))}
            </nav>

            <p className="px-2 mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              All Collections
            </p>
            <nav className="space-y-0.5">
              {allCollections.map((c) => (
                <Link
                  key={c.id}
                  href={`/collections/${c.id}`}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-foreground hover:bg-muted/50 transition-colors"
                >
                  {c.dominantTypeColor && (
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: c.dominantTypeColor }}
                      aria-hidden
                    />
                  )}
                  <span className="flex-1 truncate">{c.name}</span>
                </Link>
              ))}
              <Link
                href="/collections"
                className="block px-2 py-1.5 mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all collections
              </Link>
            </nav>
          </SidebarSection>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* User avatar */}
      <div className="px-3 pt-2 border-t border-border">
        <form action={signOutAction}>
          <div className="relative group">
            <button
              type="button"
              className="flex w-full items-center gap-2.5 px-2 py-2 rounded-md hover:bg-muted/50 transition-colors"
            >
              <UserAvatar src={user.image} name={user.name} />
              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium truncate leading-tight">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate leading-tight">{user.email}</p>
                </div>
              )}
            </button>
            {!collapsed && (
              <div className="absolute bottom-full left-0 right-0 mb-1 hidden group-focus-within:block group-hover:block">
                <div className="rounded-md border bg-popover p-1 shadow-md">
                  <Link
                    href="/profile"
                    className="block px-3 py-1.5 text-sm rounded hover:bg-muted/50"
                  >
                    View Profile
                  </Link>
                  <button
                    type="submit"
                    className="block w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted/50 text-destructive"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
