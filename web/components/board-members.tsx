"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Trash2, Shield, Eye, Pencil } from "lucide-react";
import {
  addBoardMember,
  fetchBoardMembers,
  removeBoardMember,
  updateBoardMemberRole,
} from "@/lib/api";
import { queryKeys, useUserSearch } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface BoardMembersProps {
  boardId: string;
  isOwner: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROLE_OPTIONS = [
  { value: "EDITOR", label: "Editor", icon: Pencil, description: "Can add, edit, and reorder items" },
  { value: "VIEWER", label: "Viewer", icon: Eye, description: "Can view the board" },
] as const;

function RoleIcon({ role }: { role: string }) {
  if (role === "OWNER") return <Shield className="size-3.5 text-amber-500" />;
  if (role === "EDITOR") return <Pencil className="size-3.5 text-emerald-500" />;
  return <Eye className="size-3.5 text-zinc-400" />;
}

export function BoardMembers({ boardId, isOwner, open, onOpenChange }: BoardMembersProps) {
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"EDITOR" | "VIEWER">("VIEWER");
  const [inviteSearch, setInviteSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Members load via React Query while the sheet is open.
  const membersQuery = useQuery({
    queryKey: queryKeys.boardMembers(boardId),
    queryFn: () => fetchBoardMembers(boardId),
    enabled: open,
    staleTime: 15_000,
  });
  const members = membersQuery.data?.members ?? [];

  // Debounced user search via React Query.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(inviteSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [inviteSearch]);
  const searchQuery = useUserSearch(debouncedSearch);
  const searchResults = debouncedSearch.trim().length >= 2 ? searchQuery.data?.users ?? [] : [];

  const invalidateMembers = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.boardMembers(boardId) });

  const inviteMutation = useMutation({
    mutationFn: (email: string) => addBoardMember(boardId, email, inviteRole),
    onSuccess: () => {
      setInviteEmail("");
      setInviteSearch("");
      setDebouncedSearch("");
      invalidateMembers();
    },
    onError: (err: Error) => setError(err.message || "Couldn't add member"),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "EDITOR" | "VIEWER" }) =>
      updateBoardMemberRole(boardId, userId, role),
    onSuccess: invalidateMembers,
    onError: (err: Error) => setError(err.message || "Couldn't change role"),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeBoardMember(boardId, userId),
    onSuccess: invalidateMembers,
    onError: (err: Error) => setError(err.message || "Couldn't remove member"),
  });

  const handleSearch = (q: string) => {
    setInviteSearch(q);
    setInviteEmail("");
  };

  const handleInvite = (email: string) => {
    setError(null);
    inviteMutation.mutate(email);
  };

  const handleRoleChange = (userId: string, role: "EDITOR" | "VIEWER") => {
    setError(null);
    roleMutation.mutate({ userId, role });
  };

  const handleRemove = (userId: string) => {
    setError(null);
    removeMutation.mutate(userId);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-sm flex-col p-0">
        <SheetHeader className="px-5 py-4">
          <SheetTitle>Board Members</SheetTitle>
          <SheetDescription>
            Manage who can access this board.
          </SheetDescription>
        </SheetHeader>

        {/* Invite form (owner only) */}
        {isOwner && (
          <div className="border-b border-zinc-200 px-5 pb-4 dark:border-zinc-800">
            <Label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Invite by email
            </Label>
            <div className="relative mt-1.5">
              <Input
                value={inviteSearch}
                onChange={(e) => void handleSearch(e.target.value)}
                placeholder="Search people…"
                className="h-9 text-sm"
              />
              {searchResults.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                  {searchResults
                    .filter((u) => !members.some((m) => m.userId === u.id))
                    .map((user) => (
                      <li key={user.id}>
                        <button
                          type="button"
                          disabled={inviteMutation.isPending}
                          onClick={() => {
                            setInviteEmail(user.email);
                            setInviteSearch(user.name);
                            setDebouncedSearch("");
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
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
                          <span className="min-w-0 flex-1 truncate">{user.name}</span>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <div className="flex gap-1">
                {ROLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setInviteRole(opt.value)}
                    className={cn(
                      "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                      inviteRole === opt.value
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                className="h-7 flex-1"
                disabled={!inviteEmail || inviteMutation.isPending}
                onClick={() => void handleInvite(inviteEmail)}
              >
                <UserPlus className="mr-1 size-3" />
                {!inviteMutation.isPending ? "Add" : "Adding…"}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p className="px-5 py-2 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}

        <ScrollArea className="min-h-0 flex-1 px-5 py-3">
          {membersQuery.isPending ? (
            <p className="py-8 text-center text-sm text-zinc-400">Loading members…</p>
          ) : members.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">No members yet.</p>
          ) : (
            <ul className="space-y-1">
              {members.map((member) => (
                <li
                  key={member.userId}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                    {member.user.avatarUrl ? (
                      <Image
                        src={member.user.avatarUrl}
                        alt=""
                        width={32}
                        height={32}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    ) : (
                      member.user.name.slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {member.user.name}
                    </p>
                    <p className="truncate text-xs text-zinc-400">{member.user.email}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <RoleIcon role={member.role} />
                    {isOwner && member.role !== "OWNER" ? (
                      <select
                        value={member.role}
                        onChange={(e) =>
                          void handleRoleChange(
                            member.userId,
                            e.target.value as "EDITOR" | "VIEWER",
                          )
                        }
                        className="cursor-pointer rounded border-0 bg-transparent text-xs font-medium text-zinc-600 outline-none dark:text-zinc-300"
                      >
                        <option value="EDITOR">Editor</option>
                        <option value="VIEWER">Viewer</option>
                      </select>
                    ) : (
                      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        {member.role.charAt(0) + member.role.slice(1).toLowerCase()}
                      </span>
                    )}
                    {isOwner && member.role !== "OWNER" && (
                      <button
                        type="button"
                        onClick={() => void handleRemove(member.userId)}
                        className="ml-1 rounded p-0.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                        aria-label={`Remove ${member.user.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
