import type { LucideIcon } from "lucide-react";

export function UpcomingSection({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="mx-auto max-w-3xl py-8 sm:py-16">
      <div className="rounded-2xl border bg-card p-7 shadow-sm sm:p-10">
        <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
          <Icon className="size-6" />
        </span>
        <p className="mt-7 text-sm font-medium text-primary">Planned module</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-4 max-w-xl leading-7 text-muted-foreground">{description}</p>
        <div className="mt-8 rounded-xl border border-dashed bg-muted/45 p-5">
          <p className="text-sm font-medium">No placeholder data</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            This area will stay empty until its real schema, authorization policies, and workflows are implemented and tested.
          </p>
        </div>
      </div>
    </div>
  );
}
