import { UserPlus, UserCheck } from "lucide-react";
import { useAuthUserId, useToggleFollowUser, useIsFollowingUser } from "@/hooks/useSocial";
import { cn } from "@/lib/utils";

interface Props {
  userId: string;
  className?: string;
  size?: "sm" | "md";
}

/** Follow button for following another *user* (not a supplier). Hidden on self. */
export default function FollowUserButton({ userId, className, size = "md" }: Props) {
  const me = useAuthUserId();
  const { toggle, following } = useToggleFollowUser(userId);
  useIsFollowingUser(userId); // prime cache

  if (me === userId) return null;

  return (
    <button
      onClick={toggle}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full font-bold transition active:scale-95",
        size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm",
        following
          ? "bg-muted text-foreground border border-border"
          : "bg-foreground text-background",
        className,
      )}
    >
      {following ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
      {following ? "Following" : "Follow"}
    </button>
  );
}
