"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Compass,
  LayoutGrid,
  LogOut,
  MessagesSquare,
  Rss,
  Search,
  Settings,
  User,
  X,
} from "lucide-react";
import { clearTokens, notifyAuthChanged } from "@/lib/auth";
import { queryKeys, useMe, useUserSearch } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const NAV_LINKS = [
  { href: "/", label: "Explore", icon: Compass },
  { href: "/following", label: "Following", icon: Rss },
  { href: "/boards", label: "My Boards", icon: LayoutGrid },
  { href: "/chat", label: "Chat", icon: MessagesSquare },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLFormElement>(null);

  const { data: searchData, isFetching: searchingUsers } =
    useUserSearch(debouncedQuery);
  const userResults = searchData?.users ?? [];

  // Debounce keystrokes before hitting `GET /users/search`.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  // The access token lives in memory; when auth state changes (login/logout or
  // a silent refresh) invalidate the cached `me` so the header re-renders.
  useEffect(() => {
    const onAuth = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    };
    window.addEventListener("tb:auth", onAuth);
    return () => window.removeEventListener("tb:auth", onAuth);
  }, [queryClient]);

  const clearSearch = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
  }, []);

  // Close search dropdown on outside click.
  useEffect(() => {
    if (!searchOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        clearSearch();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchOpen, clearSearch]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    setSearchOpen(false);
    clearSearch();
    if (q) {
      router.push(`/search?q=${encodeURIComponent(q)}`);
    }
  };

  const signOut = async () => {
    clearTokens();
    notifyAuthChanged("logout");
    // Drop every cached authed response so a different account starts clean.
    queryClient.clear();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-600 text-xs font-bold text-white">
            TB
          </span>
          Travel Boards
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>

        <form ref={searchRef} onSubmit={submitSearch} className="relative ml-auto flex-1 md:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search destinations or boards…"
            className="rounded-full pl-9"
            aria-label="Search boards"
          />
          {searchOpen && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1">
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                {searchingUsers && userResults.length === 0 && (
                  <div className="px-3 py-2 text-xs text-zinc-400 dark:text-zinc-500">
                    Searching people…
                  </div>
                )}
                {query.trim() && userResults.length > 0 ? (
                  <div className="max-h-60 overflow-auto">
                    <div className="px-3 py-2 text-xs font-medium text-zinc-400 dark:text-zinc-500">
                      People
                    </div>
                    {userResults.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          clearSearch();
                          router.push(`/u/${user.id}`);
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                          {user.avatarUrl ? (
                            <Image
                              src={user.avatarUrl}
                              alt=""
                              width={28}
                              height={28}
                              className="h-full w-full object-cover"
                              unoptimized
                            />
                          ) : (
                            user.name.slice(0, 2).toUpperCase()
                          )}
                        </span>
                        <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {user.name}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="flex gap-2 border-t border-zinc-100 p-1.5 dark:border-zinc-800">
                  <Button
                    type="submit"
                    size="sm"
                    className="flex-1 rounded-xl"
                    onClick={() => {
                      setSearchOpen(false);
                      clearSearch();
                    }}
                  >
                    Search boards
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="rounded-xl"
                    onClick={() => {
                      setSearchOpen(false);
                      clearSearch();
                    }}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </form>

        <div className="flex shrink-0 items-center gap-2">
          {me ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Account menu"
                  className="flex size-9 items-center justify-center rounded-full outline-none transition-opacity hover:opacity-80"
                >
                  <Avatar className="size-9">
                    {me.avatarUrl && <AvatarImage src={me.avatarUrl} alt="" />}
                    <AvatarFallback className="bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                      {me.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="font-normal">
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {me.name}
                  </p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {me.email}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/u/${me.id}`} className="flex items-center gap-2">
                    <User className="size-4" /> My profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2">
                    <Settings className="size-4" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => void signOut()}
                  className="flex items-center gap-2 text-red-600 dark:text-red-400"
                >
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="rounded-full"
              >
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="rounded-full">
                <Link href="/signup">Join free</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Mobile nav row */}
      <nav
        aria-label="Mobile"
        className="flex items-center justify-around border-t border-zinc-200 px-2 py-1 dark:border-zinc-800 md:hidden"
      >
        {NAV_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[11px] font-medium",
              pathname === href
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-zinc-500 dark:text-zinc-400",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}