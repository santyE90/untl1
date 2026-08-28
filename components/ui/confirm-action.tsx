"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";

import { cn } from "@/lib/utils";

type HiddenValue = string | number | boolean;

export function ConfirmAction({
  action,
  fields,
  triggerLabel,
  title,
  description,
  confirmLabel = "Delete permanently",
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, HiddenValue>;
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel?: string;
  className?: string;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger
        className={cn("inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold text-destructive hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-offset-2", className)}
      >
        {triggerLabel}
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/50 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <AlertDialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
          <AlertDialog.Popup className="w-full max-w-md rounded-2xl border bg-card p-6 text-card-foreground shadow-2xl focus:outline-none data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <AlertDialog.Title className="text-lg font-bold">{title}</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">{description}</AlertDialog.Description>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AlertDialog.Close className="min-h-11 rounded-lg border px-4 text-sm font-semibold hover:bg-muted">Cancel</AlertDialog.Close>
              <form action={action}>
                {Object.entries(fields).map(([name, value]) => <input key={name} name={name} type="hidden" value={String(value)} />)}
                <button className="min-h-11 w-full rounded-lg bg-destructive px-4 text-sm font-semibold text-white hover:opacity-90" type="submit">{confirmLabel}</button>
              </form>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
