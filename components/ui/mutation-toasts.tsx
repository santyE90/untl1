"use client";

import { Toast } from "@base-ui/react/toast";
import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

function QueryFeedback() {
  const manager = Toast.useToastManager();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const handled = useRef("");

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const key = `${pathname}|${success ?? ""}|${error ?? ""}`;
    if ((!success && !error) || handled.current === key) return;
    handled.current = key;
    manager.add({ title: error ? "Couldn’t save that change" : "Change saved", description: error ?? success, type: error ? "error" : "success", priority: error ? "high" : "low" });
    const next = new URLSearchParams(searchParams.toString());
    next.delete("success"); next.delete("error");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}${window.location.hash}`, { scroll: false });
  }, [manager, pathname, router, searchParams]);
  return null;
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return <Toast.Portal><Toast.Viewport className="fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 outline-none">{toasts.map((toast) => <Toast.Root className="rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl data-[ending-style]:translate-x-4 data-[ending-style]:opacity-0 data-[starting-style]:translate-x-4 data-[starting-style]:opacity-0" key={toast.id} toast={toast}><Toast.Content className="flex items-start gap-3"><span className={toast.type === "error" ? "mt-0.5 text-destructive" : "mt-0.5 text-success"}>{toast.type === "error" ? <CircleAlert className="size-5" /> : <CheckCircle2 className="size-5" />}</span><div className="min-w-0 flex-1"><Toast.Title className="font-bold" /><Toast.Description className="mt-1 break-words text-sm text-muted-foreground" /></div><Toast.Close aria-label="Dismiss notification" className="flex size-10 shrink-0 items-center justify-center rounded-lg hover:bg-muted"><X className="size-4" /></Toast.Close></Toast.Content></Toast.Root>)}</Toast.Viewport></Toast.Portal>;
}

export function MutationToasts() {
  return <Toast.Provider timeout={5000} limit={3}><QueryFeedback /><ToastList /></Toast.Provider>;
}

