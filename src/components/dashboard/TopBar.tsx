import { Search, FolderPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function TopBar() {
  return (
    <header className="flex items-center gap-3 border-b border-border px-4 py-3">
      <div className="flex items-center gap-2 text-lg font-bold text-foreground shrink-0">
        <div className="flex size-7 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold">
          DS
        </div>
        DevStash
      </div>

      <div className="relative flex-1 max-w-md mx-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search items..."
          className="pl-9 bg-muted/50 border-border"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-muted-foreground">
          ⌘K
        </kbd>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm">
          <FolderPlus className="size-4 mr-2" />
          New Collection
        </Button>
        <Button size="sm">
          <Plus className="size-4 mr-2" />
          New Item
        </Button>
      </div>
    </header>
  );
}
