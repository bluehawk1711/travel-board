import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchProfile, fetchUserBoards, ApiError } from "@/lib/api";
import type { PublicProfile, UserBoardsResult } from "@/lib/types";
import { UserProfileView } from "@/components/user-profile";

// Cache Components: profile data + metadata stream at request time behind the
// segment's loading.tsx Suspense boundary.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const user = await fetchProfile(id);
    return { title: user.name, description: user.bio ?? undefined };
  } catch {
    return { title: "Profile" };
  }
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, boards } = await loadProfile(id);
  return <UserProfileView initialProfile={user} initialBoards={boards} />;
}

/**
 * Data loading is kept outside the JSX so render errors aren't swallowed by a
 * try/catch (React only catches rendering errors in error boundaries).
 */
async function loadProfile(
  id: string,
): Promise<{ user: PublicProfile; boards: UserBoardsResult }> {
  try {
    const [user, boards] = await Promise.all([
      fetchProfile(id),
      fetchUserBoards(id, 24, 0),
    ]);
    return { user, boards };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }
}