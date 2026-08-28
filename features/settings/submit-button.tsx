"use client";

import { useFormStatus } from "react-dom";

export function SettingsSubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button className="min-h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-60" disabled={pending} type="submit">{pending ? "Saving…" : children}</button>;
}
