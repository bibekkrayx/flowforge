"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type CreateChoiceProps = {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
};

export const CreateChoice = ({
  icon,
  title,
  description,
  onClick,
}: CreateChoiceProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex flex-col items-start gap-2 rounded-lg border border-border bg-muted/30 p-4 text-left transition-colors",
      "hover:border-primary/40 hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
    )}
  >
    <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
      {icon}
    </div>
    <div className="flex flex-col gap-0.5">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  </button>
);
