'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function SidebarSection({
  label,
  defaultOpen = true,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-2 py-1 mb-1 rounded hover:bg-muted/50 transition-colors group"
      >
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <ChevronDown
          className={`size-3 text-muted-foreground transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && children}
    </>
  );
}
