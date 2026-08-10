import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  type,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-lg border bg-slate-950/60 px-3 py-2 text-sm transition-[border-color,background-color,box-shadow] outline-none placeholder:text-slate-500 hover:border-white/20 hover:bg-slate-950/80 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-50",
        type === "number" &&
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className,
      )}
      {...props}
    />
  );
}
