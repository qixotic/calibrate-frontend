"use client";

import { ChevronDownIcon } from "@/components/icons";

/**
 * The View more / View less control used wherever a block is folded away:
 * prompt clamps, overflowing chip rows, and the ineligible-evaluators banner.
 * The parent owns open state; this only draws the button.
 */
export function ViewMoreToggle({
  expanded,
  onClick,
  className = "",
  "aria-controls": ariaControls,
}: {
  expanded: boolean;
  onClick: () => void;
  className?: string;
  "aria-controls"?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-controls={ariaControls}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors cursor-pointer ${className}`}
    >
      {expanded ? "View less" : "View more"}
      <ChevronDownIcon
        className={`w-3.5 h-3.5 transition-transform ${
          expanded ? "rotate-180" : ""
        }`}
      />
    </button>
  );
}
