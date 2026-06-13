'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Code,
  Sparkles,
  Terminal,
  StickyNote,
  File,
  Image,
  Link as LinkIcon,
  Star,
  ChevronDown,
  Settings,
} from 'lucide-react';
import { mockCollections, mockItemTypeCounts, mockUser } from '@/lib/mock-data';

const itemTypes = [
  { name: 'snippet', label: 'Snippets', icon: Code, color: '#3b82f6' },
  { name: 'prompt', label: 'Prompts', icon: Sparkles, color: '#8b5cf6' },
  { name: 'command', label: 'Commands', icon: Terminal, color: '#f97316' },
  { name: 'note', label: 'Notes', icon: StickyNote, color: '#fde047' },
  { name: 'file', label: 'Files', icon: File, color: '#6b7280' },
  { name: 'image', label: 'Images', icon: Image, color: '#ec4899' },
  { name: 'link', label: 'Links', icon: LinkIcon, color: '#10b981' },
];

interface SidebarProps {
  collapsed: boolean;
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const [typesOpen, setTypesOpen] = useState(true);
  const [collectionsOpen, setCollectionsOpen] = useState(true);

  const favoriteCollections = mockCollections.filter((c) => c.isFavorite);
  const allCollections = mockCollections.filter((c) => !c.isFavorite);

  return (
    <div className="flex flex-col h-full py-2">
      {/* Types */}
      <div className="px-3">
        {!collapsed && (
          <button
            onClick={() => setTypesOpen((o) => !o)}
            className="flex items-center justify-between w-full px-2 py-1 mb-1 rounded hover:bg-muted/50 transition-colors group"
          >
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Types
            </span>
            <ChevronDown
              className={`size-3 text-muted-foreground transition-transform duration-200 ${typesOpen ? '' : '-rotate-90'}`}
            />
          </button>
        )}
        {(collapsed || typesOpen) && (
          <nav className="space-y-0.5">
            {itemTypes.map(({ name, label, icon: Icon, color }) => (
              <Link
                key={name}
                href={`/items/${name}s`}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-foreground hover:bg-muted/50 transition-colors"
              >
                <Icon className="size-4 shrink-0" style={{ color }} />
                {!collapsed && (
                  <>
                    <span className="flex-1">{label}</span>
                    <span className="text-xs text-muted-foreground">
                      {mockItemTypeCounts[name as keyof typeof mockItemTypeCounts]}
                    </span>
                  </>
                )}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {/* Collections */}
      {!collapsed && (
        <div className="mt-2 px-3 border-t border-border pt-3">
          <button
            onClick={() => setCollectionsOpen((o) => !o)}
            className="flex items-center justify-between w-full px-2 py-1 mb-2 rounded hover:bg-muted/50 transition-colors"
          >
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Collections
            </span>
            <ChevronDown
              className={`size-3 text-muted-foreground transition-transform duration-200 ${collectionsOpen ? '' : '-rotate-90'}`}
            />
          </button>

          {collectionsOpen && (
            <>
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
                    <span className="flex-1 truncate">{c.name}</span>
                  </Link>
                ))}
              </nav>
            </>
          )}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* User avatar */}
      <div className="px-3 pt-2 border-t border-border">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer">
          <div className="size-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
            {mockUser.name.charAt(0)}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate leading-tight">
                  {mockUser.name}
                </p>
                <p className="text-xs text-muted-foreground truncate leading-tight">
                  {mockUser.email}
                </p>
              </div>
              <Settings className="size-4 text-muted-foreground shrink-0" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}