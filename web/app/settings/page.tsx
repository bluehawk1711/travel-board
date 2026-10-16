"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Save } from "lucide-react";
import { fetchMySettings, updateMyProfile, updateMySettings, uploadImage } from "@/lib/api";
import { clearTokens, notifyAuthChanged } from "@/lib/auth";
import { useSignedIn } from "@/hooks/use-signed-in";
import { queryKeys, useMe } from "@/lib/queries";
import { initials } from "@/lib/utils";
import type { ThemeMode, UserSettings } from "@/lib/types";
import { THEME_MODES } from "@travel-board/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import FileUpload from "@/components/shadcn-space/file-upload/file-upload-05";

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [meta, base64] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  // Session state comes from an external store read (no setState-in-effect);
  // the edge guard in `proxy.ts` handles the redirect for anonymous visitors.
  const signedIn = useSignedIn();
  // `null` draft = "show the server value"; typing fills the draft.
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [bioDraft, setBioDraft] = useState<string | null>(null);
  const [avatarDone, setAvatarDone] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Server state via React Query. `useMe` (shared with the site header) caches
  // the FLAT AuthUser under ["me"] — always write that shape, never {user}.
  const meQuery = useMe();
  const settingsQuery = useQuery({
    queryKey: queryKeys.mySettings,
    queryFn: fetchMySettings,
    enabled: signedIn,
  });

  const me = meQuery.data ?? null;
  const settings = settingsQuery.data ?? null;

  // Derive the editable fields instead of copying them into state via an
  // effect: the server value is the fallback until the user types.
  const name = nameDraft ?? me?.name ?? "";
  const bio = bioDraft ?? me?.bio ?? "";

  const settingsMutation = useMutation({
    mutationFn: (patch: Partial<UserSettings>) => updateMySettings(patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.mySettings, updated);
      setSettingsSaved(true);
      window.setTimeout(() => setSettingsSaved(false), 2000);
    },
    onError: (err: Error) => setError(err.message || "Save failed"),
  });

  const saveSettings = (patch: Partial<UserSettings>) => {
    setError(null);
    settingsMutation.mutate(patch);
  };

  const avatarMutation = useMutation({
    mutationFn: async (dataUrl: string) => {
      const file = dataUrlToFile(dataUrl, "avatar.png");
      const { url } = await uploadImage(file);
      const { user } = await updateMyProfile({ avatarUrl: url });
      return user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.me, user);
      setAvatarDone(true);
      notifyAuthChanged("login");
    },
    onError: (err: Error) => setError(err.message || "Upload failed"),
  });

  const handleAvatar = (dataUrl: string) => {
    setError(null);
    avatarMutation.mutate(dataUrl);
  };

  const profileMutation = useMutation({
    mutationFn: () =>
      updateMyProfile({
        name: name.trim() || undefined,
        bio: bio.trim() || undefined,
      }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(queryKeys.me, user);
      // Drop the drafts so the fresh server values render.
      setNameDraft(null);
      setBioDraft(null);
      setSavedAt(Date.now());
      notifyAuthChanged("login");
    },
    onError: (err: Error) => setError(err.message || "Save failed"),
  });

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    profileMutation.mutate();
  };

  // A failed `me` read (expired session the bootstrap couldn't renew) must not
  // spin forever — send the user back through login, which restores the cookie.
  useEffect(() => {
    if (meQuery.isError) {
      clearTokens();
      notifyAuthChanged("logout");
      router.replace("/login");
    }
  }, [meQuery.isError, router]);

  if (!me) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-zinc-400" />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Settings
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Your public profile — how other travellers see you.
      </p>

      <div className="mt-8 grid gap-8 md:grid-cols-[240px_1fr]">
        {/* Avatar */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Profile photo
          </h2>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center gap-4">
              <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-lg font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                {me.avatarUrl ? (
                  <Image
                    src={me.avatarUrl}
                    alt={me.name}
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials(me.name, me.email)
                )}
              </span>
              <div className="text-sm">
                <p className="font-medium text-zinc-900 dark:text-zinc-50">
                  {me.name}
                </p>
                {avatarDone ? (
                  <p className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Check className="size-3.5" /> New photo saved
                  </p>
                ) : (
                  <p className="text-zinc-500 dark:text-zinc-400">
                    Square crop, JPEG/PNG/WebP
                  </p>
                )}
              </div>
            </div>
            {avatarMutation.isPending && (
              <p className="mb-3 flex items-center gap-2 text-sm text-zinc-500">
                <Loader2 className="size-4 animate-spin" /> Uploading photo…
              </p>
            )}
            <FileUpload onComplete={(dataUrl) => void handleAvatar(dataUrl)} />
          </div>
        </section>

        {/* Details */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Profile details
          </h2>
          <form
            onSubmit={saveProfile}
            className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="space-y-1.5">
              <Label htmlFor="settings-name">Name</Label>
              <Input
                id="settings-name"
                value={name}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={60}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-bio">Bio</Label>
              <Textarea
                id="settings-bio"
                value={bio}
                onChange={(e) => setBioDraft(e.target.value)}
                maxLength={300}
                rows={4}
                placeholder="Where have you been? What are you planning next?"
              />
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                {bio.length}/300
              </p>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400"
              >
                {error}
              </p>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={profileMutation.isPending}>
                {profileMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save changes
              </Button>
              {savedAt && !profileMutation.isPending && (
                <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
                  <Check className="size-4" /> Saved
                </span>
              )}
            </div>
          </form>
        </section>

        {/* Preferences */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Preferences
          </h2>
          <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="space-y-1.5">
              <Label htmlFor="settings-theme">Theme</Label>
              <select
                id="settings-theme"
                value={settings?.themeMode ?? "SYSTEM"}
                disabled={settingsMutation.isPending || !settings}
                onChange={(e) =>
                  void saveSettings({
                    themeMode: e.target.value as ThemeMode,
                  })
                }
                className="h-9 w-full rounded-md border border-zinc-200 bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-zinc-400 dark:border-zinc-800"
              >
                {THEME_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode === "SYSTEM" ? "System default" : mode === "LIGHT" ? "Light" : "Dark"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settings-currency">Currency</Label>
              <select
                id="settings-currency"
                value={settings?.currency ?? "USD"}
                disabled={settingsMutation.isPending || !settings}
                onChange={(e) =>
                  void saveSettings({ currency: e.target.value })
                }
                className="h-9 w-full rounded-md border border-zinc-200 bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-zinc-400 dark:border-zinc-800"
              >
                {["USD", "EUR", "GBP", "JPY", "INR", "AUD", "CAD", "SGD"].map(
                  (code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ),
                )}
              </select>
            </div>

            {(
              [
                {
                  key: "notificationsEnabled" as const,
                  label: "Push & in-app notifications",
                  hint: "Likes, comments, follows, and board activity",
                },
                {
                  key: "emailUpdates" as const,
                  label: "Email updates",
                  hint: "Occasional product news and trip summaries",
                },
              ]
            ).map(({ key, label, hint }) => (
              <label
                key={key}
                className="flex items-center justify-between gap-4 rounded-xl bg-zinc-50 px-4 py-3 dark:bg-zinc-800/50"
              >
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {label}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {hint}
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="size-4 accent-(--primary)"
                  checked={settings ? settings[key] : false}
                  disabled={settingsMutation.isPending || !settings}
                  onChange={(e) => void saveSettings({ [key]: e.target.checked })}
                />
              </label>
            ))}

            {settingsSaved && (
              <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
                <Check className="size-4" /> Preferences saved
              </span>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}