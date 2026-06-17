import { getCurrentUserId } from "@/lib/db/user";
import { getProfileData, getProfileStats } from "@/lib/db/profile";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileStats from "@/components/profile/ProfileStats";
import ChangePasswordForm from "@/components/profile/ChangePasswordForm";
import DeleteAccountSection from "@/components/profile/DeleteAccountSection";

export default async function ProfilePage() {
  const userId = await getCurrentUserId();
  const [profile, stats] = await Promise.all([
    getProfileData(userId),
    getProfileStats(userId),
  ]);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="sr-only">Profile</h1>
      <ProfileHeader profile={profile} />
      <ProfileStats stats={stats} />
      {profile.hasPassword && <ChangePasswordForm />}
      <DeleteAccountSection />
    </main>
  );
}
