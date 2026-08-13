"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import type { DayPickerProps } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DatePickerProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: DayPickerProps["disabled"];
  invalid?: boolean;
  describedBy?: string;
  className?: string;
};

function parseDateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parts = value.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year === undefined || month === undefined || day === undefined) {
    return undefined;
  }
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
    ? undefined
    : date;
}

function toDateValue(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function DatePicker({
  id,
  label,
  value,
  onChange,
  disabled,
  invalid = false,
  describedBy,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseDateValue(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-label={`Choose ${label.toLowerCase()} date`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            "w-full justify-between px-3 font-normal text-slate-200 hover:translate-y-0",
            !selected && "text-slate-500",
            className,
          )}
        >
          <span className="truncate">
            {selected ? format(selected, "MMM d, yyyy") : "Select date"}
          </span>
          <CalendarDays className="size-4 shrink-0 text-slate-500" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (!date) return;
            onChange(toDateValue(date));
            setOpen(false);
          }}
          defaultMonth={selected}
          disabled={disabled}
          fixedWeeks
        />
        {selected ? (
          <div className="border-t border-white/10 p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear date
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
