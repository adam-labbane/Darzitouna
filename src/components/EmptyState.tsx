import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
}

export default function EmptyState({ icon: Icon = Inbox, title, description }: EmptyStateProps) {
  return (
    <div className="text-center bg-white rounded-2xl shadow-soft p-8">
      <Icon size={36} aria-hidden="true" className="mx-auto text-gray-300 mb-3" />
      <p className="font-semibold text-gray-700">{title}</p>
      {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
    </div>
  );
}
