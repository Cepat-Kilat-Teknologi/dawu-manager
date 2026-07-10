"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  variant?: "default" | "destructive";
}

/**
 * Reusable confirmation dialog with async action support.
 * Displays a title, description, cancel/confirm buttons, and shows a loading spinner
 * while the confirm action is in progress. Prevents closing while loading.
 * @param open - Whether the dialog is visible
 * @param onOpenChange - Callback to toggle dialog visibility
 * @param title - Dialog heading text
 * @param description - Explanatory text below the heading
 * @param confirmLabel - Text for the confirm button (default: "Confirm")
 * @param loading - External loading state override
 * @param onConfirm - Async callback invoked when confirm is clicked
 * @param variant - Button variant for the confirm button (default: "destructive")
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  loading = false,
  onConfirm,
  variant = "destructive",
}: ConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = loading || internalLoading;

  /**
   * Handle the confirm button click — wraps onConfirm with internal loading state.
   */
  async function handleConfirm() {
    setInternalLoading(true);
    try {
      await onConfirm();
    } finally {
      setInternalLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={isLoading ? undefined : onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant={variant}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
