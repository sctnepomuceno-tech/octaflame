"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { globalSearch, type SearchResult } from "@/app/actions/search";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

/** Global search / ⌘K command palette (§14). Mounted once in the app shell. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function onOpenRequest() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("open-command-palette", onOpenRequest);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("open-command-palette", onOpenRequest);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      startTransition(async () => {
        const data = await globalSearch(query);
        setResults(data);
      });
    }, 150);
    return () => clearTimeout(handle);
  }, [query, open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const r of results) {
      const list = map.get(r.category) ?? [];
      list.push(r);
      map.set(r.category, list);
    }
    return map;
  }, [results]);

  function select(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search customers, sales, tasks, and more">
      <CommandInput placeholder="Search customers, sales, municipalities, DSPs, inventory, truck reports, tasks…" value={query} onValueChange={setQuery} />
      <CommandList>
        {query.trim().length < 2 ? (
          <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
        ) : results.length === 0 ? (
          <CommandEmpty>No results.</CommandEmpty>
        ) : null}
        {[...grouped.entries()].map(([category, items]) => (
          <CommandGroup key={category} heading={category}>
            {items.map((item) => (
              <CommandItem key={`${item.category}-${item.id}`} value={`${category}-${item.id}-${item.title}`} onSelect={() => select(item.href)}>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{item.title}</span>
                  {item.subtitle ? <span className="truncate text-xs text-muted-foreground">{item.subtitle}</span> : null}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
