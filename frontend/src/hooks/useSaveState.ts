import { useState, useCallback, useEffect } from "react";

interface UseSaveStateOptions<T> {
  /** Function to call when saving */
  onSave?: (data: T) => Promise<void> | void;
  /** Enable Cmd/Ctrl+S keyboard shortcut */
  enableKeyboardShortcut?: boolean;
}

interface UseSaveStateReturn<T> {
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Whether currently saving */
  isSaving: boolean;
  /** Last saved timestamp */
  lastSaved: Date | null;
  /** Mark content as changed */
  markChanged: () => void;
  /** Reset dirty state (e.g., when content updates externally) */
  resetDirty: () => void;
  /** Trigger save with the provided data */
  save: (data: T) => Promise<void>;
}

/**
 * Shared hook for managing save state across editors.
 * Handles dirty tracking, loading state, and optional keyboard shortcuts.
 */
export function useSaveState<T>({
  onSave,
  enableKeyboardShortcut = false,
}: UseSaveStateOptions<T>): UseSaveStateReturn<T> {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [pendingSave, setPendingSave] = useState<(() => Promise<void>) | null>(null);

  const markChanged = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  const resetDirty = useCallback(() => {
    setHasUnsavedChanges(false);
  }, []);

  const save = useCallback(async (data: T) => {
    if (!onSave) return;

    setIsSaving(true);
    try {
      await onSave(data);
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to save:", error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [onSave]);

  // Keyboard shortcut handler
  useEffect(() => {
    if (!enableKeyboardShortcut || !onSave) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (hasUnsavedChanges && pendingSave) {
          pendingSave();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enableKeyboardShortcut, onSave, hasUnsavedChanges, pendingSave]);

  return {
    hasUnsavedChanges,
    isSaving,
    lastSaved,
    markChanged,
    resetDirty,
    save,
  };
}

/**
 * Format a date as relative time (e.g., "just now", "2m ago")
 */
export function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}


