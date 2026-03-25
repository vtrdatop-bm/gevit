import { cn } from "@/lib/utils";
import {
  DisplayStatus,
  VistoriaStage,
  displayStatusLabels,
  displayStatusBadgeClass,
} from "@/lib/vistoriaStatus";

interface StatusBadgeProps {
  status: DisplayStatus;
  stage?: VistoriaStage;
  className?: string;
}

export default function StatusBadge({ status, stage, className }: StatusBadgeProps) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap",
          displayStatusBadgeClass[status] || "status-badge-risk",
          className
        )}
      >
        {displayStatusLabels[status] || status}
      </span>
      {stage && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium stage-badge whitespace-nowrap">
          {stage}ª Vist.
        </span>
      )}
    </span>
  );
}
