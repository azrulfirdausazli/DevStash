"use server";

import { getCurrentUserId } from "@/lib/db/user";
import { getProfileData, getProfileStats } from "@/lib/db/profile";

export type ProfilePageData = {
  profile: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    createdAt: string;
    hasPassword: boolean;
  };
  stats: {
    itemCount: number;
    collectionCount: number;
    breakdown: Array<{
      typeId: string;
      name: string;
      icon: string;
      color: string;
      count: number;
    }>;
  };
};

export async function getProfilePageData(): Promise<ProfilePageData> {
  const userId = await getCurrentUserId();
  const [profile, stats] = await Promise.all([
    getProfileData(userId),
    getProfileStats(userId),
  ]);
  return {
    profile: {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      image: profile.image,
      createdAt: profile.createdAt.toISOString(),
      hasPassword: profile.hasPassword,
    },
    stats,
  };
}
