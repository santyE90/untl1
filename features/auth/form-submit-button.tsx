"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function FormSubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <Button className="h-11 w-full" disabled={pending} type="submit">
      {pending ? "Please wait…" : children}
    </Button>
  );
}
