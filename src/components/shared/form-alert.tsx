/**
 * Inline form error alert.
 *
 * Renders a styled error message with `role="alert"` for screen readers.
 * Used in login, setup, new-node, and edit-node forms.
 *
 * Returns `null` when `message` is falsy — safe to render unconditionally.
 */

interface FormAlertProps {
  /** Error message to display. Pass empty string or undefined to hide. */
  message?: string;
}

export function FormAlert({ message }: FormAlertProps) {
  if (!message) return null;

  return (
    <div
      className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
      role="alert"
    >
      {message}
    </div>
  );
}
