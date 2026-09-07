"use client";

import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { useSetAtom } from "jotai";
import { memo } from "react";
import { nodeSelectorOpenAtom } from "../store/atoms";
import { cn } from "@/lib/utils";

type OpenNodeSelectorButtonProps = {
  variant?: "icon" | "outline" | "ghost";
  size?: "sm" | "icon";
  label?: string;
  className?: string;
};

export const OpenNodeSelectorButton = memo(
  ({
    variant = "outline",
    size = "sm",
    label = "Add node",
    className,
  }: OpenNodeSelectorButtonProps) => {
    const setSelectorOpen = useSetAtom(nodeSelectorOpenAtom);

    if (variant === "icon") {
      return (
        <Button
          onClick={() => setSelectorOpen(true)}
          size="icon"
          variant="outline"
          className={cn("bg-background", className)}
          aria-label={label}
        >
          <PlusIcon />
        </Button>
      );
    }

    return (
      <Button
        onClick={() => setSelectorOpen(true)}
        size={size}
        variant={variant}
        className={className}
      >
        <PlusIcon className="size-4" />
        {label}
      </Button>
    );
  },
);

OpenNodeSelectorButton.displayName = "OpenNodeSelectorButton";
