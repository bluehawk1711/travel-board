import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchProfile, fetchUserBoards, ApiError } from "@/lib/api";
import { UserProfileView } from "@/components/user-profile";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const { user } = await fetchProfile(id);
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
  try {
    const [{ user }, boards] = await Promise.all([
      fetchProfile(id),
      fetchUserBoards(id, 24, 0),
    ]);
    return <UserProfileView initialProfile={user} initialBoards={boards} />;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }
}