"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  DayPicker,
  type DayButtonProps,
  type DayPickerProps,
} from "react-day-picker";
import { cn } from "@/lib/utils";

function CalendarDayButton({ className, modifiers, ...props }: DayButtonProps) {
  return (
    <button
      className={cn(
        className,
        modifiers.selected &&
          "rounded-lg bg-cyan-300 font-semibold text-slate-950 hover:bg-cyan-200 hover:text-slate-950",
        !modifiers.selected && modifiers.today && "text-cyan-300",
        !modifiers.selected && modifiers.outside && "text-slate-500",
        modifiers.disabled && "cursor-not-allowed text-slate-700 opacity-50",
      )}
      {...props}
    />
  );
}

export function Calendar({
  className,
  classNames,
  components,
  labels,
  showOutsideDays = true,
  ...props
}: DayPickerProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      navLayout="around"
      className={cn("p-3", className)}
      classNames={{
        root: "rdp-root",
        months: "flex flex-col",
        month: "relative space-y-3",
        month_caption: "flex h-8 items-center justify-center",
        caption_label: "text-sm font-semibold text-slate-100",
        nav: "hidden",
        button_previous:
          "absolute top-0 left-0 grid size-8 cursor-pointer place-items-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none",
        button_next:
          "absolute top-0 right-0 grid size-8 cursor-pointer place-items-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none",
        chevron: "size-4 fill-current",
        month_grid: "w-full border-collapse",
        weekdays: "border-b border-white/10",
        weekday:
          "size-9 pb-2 text-center text-[0.7rem] font-medium text-slate-500",
        week: "",
        day: "p-0 text-center",
        day_button:
          "grid size-9 cursor-pointer place-items-center rounded-lg text-sm text-slate-200 transition-colors hover:bg-cyan-300/10 hover:text-cyan-100 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none",
        ...classNames,
      }}
      components={{ DayButton: CalendarDayButton, ...components }}
      labels={{
        labelDayButton: (date) => `Select ${format(date, "yyyy-MM-dd")}`,
        ...labels,
      }}
      {...props}
    />
  );
}
