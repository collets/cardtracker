"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "group flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border bg-slate-950/60 px-3 py-2 text-sm text-slate-200 transition-[border-color,background-color,box-shadow] outline-none hover:border-white/20 hover:bg-slate-950/80 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-slate-500",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="size-4 shrink-0 text-slate-500 transition-colors group-hover:text-slate-300" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(
  (
    { className, children, position = "popper", sideOffset = 6, ...props },
    ref,
  ) => (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        sideOffset={sideOffset}
        className={cn(
          "z-50 max-h-72 min-w-[8rem] overflow-hidden rounded-xl border border-white/15 bg-slate-950/95 p-1 text-slate-200 shadow-2xl shadow-black/40 backdrop-blur-xl data-[state=closed]:opacity-0 data-[state=open]:opacity-100",
          position === "popper" &&
            "w-[var(--radix-select-trigger-width)] translate-y-0",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  ),
);
SelectContent.displayName = SelectPrimitive.Content.displayName;

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer items-center rounded-lg py-2 pr-8 pl-3 text-sm transition-colors outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-cyan-300/10 data-[highlighted]:text-cyan-100",
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <span className="absolute right-2 grid size-4 place-items-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="size-3.5 text-cyan-300" />
      </SelectPrimitive.ItemIndicator>
    </span>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;
