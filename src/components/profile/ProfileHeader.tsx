import { Card, CardContent } from "@/components/ui/card";
import UserAvatar from "@/components/auth/UserAvatar";
import { formatDateLong } from "@/lib/utils";
import type { ProfileData } from "@/lib/db/profile";

export default function ProfileHeader({ profile }: { profile: ProfileData }) {
  const displayName = profile.name ?? profile.email;
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <UserAvatar src={profile.image} name={displayName} size={64} />
        <div className="min-w-0">
          <h2 className="text-xl font-semibold truncate">
            {profile.name ?? "Unnamed user"}
          </h2>
          <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Member since {formatDateLong(profile.createdAt)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
