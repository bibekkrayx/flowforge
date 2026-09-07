"use client";

import { memo } from "react";
import { OpenNodeSelectorButton } from "./open-node-selector-button";

export const AddNodeButton = memo(() => {
  return <OpenNodeSelectorButton variant="icon" />;
});

AddNodeButton.displayName = "AddNodeButton";
