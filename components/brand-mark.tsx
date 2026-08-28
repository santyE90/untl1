import { Cat } from "lucide-react";

import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm", className)}>
      <Cat className="size-5" />
    </span>
  );
}
