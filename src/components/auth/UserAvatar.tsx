interface UserAvatarProps {
  src?: string | null;
  name: string;
  size?: number;
}

export default function UserAvatar({ src, name, size = 28 }: UserAvatarProps) {
  const initials = (name ?? "")
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="rounded-full shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
}
