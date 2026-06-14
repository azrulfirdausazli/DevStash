'use client';

import { useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import type { SidebarItemType } from '@/lib/db/item-types';
import type { SidebarCollection } from '@/lib/db/collections';

interface DashboardShellProps {
  children: React.ReactNode;
  sidebarItemTypes: SidebarItemType[];
  sidebarCollections: SidebarCollection[];
}

export default function DashboardShell({
  children,
  sidebarItemTypes,
  sidebarCollections,
}: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex flex-1 overflow-hidden relative">
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-r border-border overflow-y-auto overflow-x-hidden transition-all duration-200 shrink-0 ${
          collapsed ? 'w-14' : 'w-60'
        }`}
      >
        <div className="flex items-center justify-end px-2 py-2 border-b border-border">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground transition-colors"
            aria-label="Toggle sidebar"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
        </div>
        <Sidebar
          collapsed={collapsed}
          itemTypes={sidebarItemTypes}
          collections={sidebarCollections}
        />
      </aside>

      {/* Mobile drawer sidebar */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-64 bg-background border-r border-border z-50 flex flex-col lg:hidden transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-3 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 text-sm font-bold">
            <div className="flex size-6 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold">
              DS
            </div>
            DevStash
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground transition-colors"
            aria-label="Close sidebar"
          >
            <PanelLeftClose className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Sidebar
            collapsed={false}
            itemTypes={sidebarItemTypes}
            collections={sidebarCollections}
          />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile menu button */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground transition-colors"
            aria-label="Open sidebar"
          >
            <Menu className="size-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}