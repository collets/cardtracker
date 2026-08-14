import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  label: React.ReactNode;
  containerClassName?: string;
  labelClassName?: string;
}

export function Checkbox({
  label,
  className,
  containerClassName,
  labelClassName,
  disabled,
  ...props
}: CheckboxProps) {
  return (
    <label
      className={cn(
        "group flex cursor-pointer items-center gap-2 text-sm text-slate-300 transition-colors hover:text-white",
        disabled && "cursor-not-allowed opacity-50 hover:text-slate-300",
        containerClassName,
      )}
    >
      <span className="relative grid size-4 shrink-0 place-items-center">
        <input
          type="checkbox"
          disabled={disabled}
          className={cn(
            "peer size-4 cursor-pointer appearance-none rounded border border-white/25 bg-slate-950/80 transition-[border-color,background-color,box-shadow] group-hover:border-cyan-300/60 group-hover:bg-cyan-300/10 group-hover:shadow-sm group-hover:shadow-cyan-300/15 checked:border-cyan-300 checked:bg-cyan-300 hover:border-cyan-300/60 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none disabled:cursor-not-allowed",
            className,
          )}
          {...props}
        />
        <Check className="pointer-events-none absolute size-3 text-slate-950 opacity-0 transition-opacity peer-checked:opacity-100" />
      </span>
      <span className={cn(labelClassName)}>{label}</span>
    </label>
  );
}
