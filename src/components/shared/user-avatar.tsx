import { Avatar } from "@/components/ui/avatar";
import type { AvatarProps } from "@/components/ui/avatar";

export interface UserAvatarProps extends AvatarProps {
  name: string;
}

export function UserAvatar({ name, ...props }: UserAvatarProps) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join(" ")
    .toUpperCase();
  return <Avatar fallback={initials} {...props} />;
}
