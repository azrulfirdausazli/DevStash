"use client";

import { useEffect, useRef, useState } from "react";
import UserAvatar from "@/components/auth/UserAvatar";
import ProfileModal from "@/components/profile/ProfileModal";
import { signOutAction } from "@/actions/signout";

interface UserMenuProps {
  user: { name: string; email: string; image: string | null };
}

export default function UserMenu({ user }: UserMenuProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [dropdownOpen]);

  const openModal = () => {
    setDropdownOpen(false);
    setModalOpen(true);
  };

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          className="flex w-full items-center gap-2.5 px-2 py-2 rounded-md hover:bg-muted/50 transition-colors"
          aria-haspopup="menu"
          aria-expanded={dropdownOpen}
        >
          <UserAvatar src={user.image} name={user.name} />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium truncate leading-tight">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate leading-tight">
              {user.email}
            </p>
          </div>
        </button>
        {dropdownOpen && (
          <div className="absolute bottom-full left-0 right-0 mb-1 z-50 rounded-md border bg-popover p-1 shadow-md">
            <button
              type="button"
              onClick={openModal}
              className="block w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted/50"
            >
              View Profile
            </button>
            <form action={signOutAction}>
              <button
                type="submit"
                className="block w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted/50 text-destructive"
              >
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
      <ProfileModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
