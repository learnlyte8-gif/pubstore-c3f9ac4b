import { ReactNode } from "react";
import { PackageOpen } from "lucide-react";

export default function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-12">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-3 shadow-soft">
        {icon ?? <PackageOpen className="w-7 h-7 text-muted-foreground" />}
      </div>
      <p className="text-sm font-bold">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
