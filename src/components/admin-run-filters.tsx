"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RUN_KINDS = ["catalog", "market", "cleanup"] as const;
const RUN_STATUSES = ["running", "succeeded", "failed"] as const;

function toLocalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
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

type AdminRunFiltersProps = {
  initialFilters: {
    kind: string;
    status: string;
    from: string;
    to: string;
  };
};

export function AdminRunFilters({ initialFilters }: AdminRunFiltersProps) {
  const key = `${initialFilters.kind}|${initialFilters.status}|${initialFilters.from}|${initialFilters.to}`;
  return <AdminRunFiltersForm key={key} initialFilters={initialFilters} />;
}

function AdminRunFiltersForm({ initialFilters }: AdminRunFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [kind, setKind] = React.useState(initialFilters.kind || "all");
  const [status, setStatus] = React.useState(initialFilters.status || "all");
  const [from, setFrom] = React.useState(initialFilters.from);
  const [to, setTo] = React.useState(initialFilters.to);
  const hasInvalidDateRange = Boolean(from && to && from > to);
  const fromDate = toLocalDate(from);
  const toDate = toLocalDate(to);

  function navigate(next: {
    kind: string;
    status: string;
    from: string;
    to: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    for (const [name, value] of Object.entries(next)) {
      if (!value || value === "all") params.delete(name);
      else params.set(name, value);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasInvalidDateRange) return;
    navigate({ kind, status, from, to });
  }

  function resetFilters() {
    setKind("all");
    setStatus("all");
    setFrom("");
    setTo("");
    navigate({ kind: "", status: "", from: "", to: "" });
  }

  const hasFilters = kind !== "all" || status !== "all" || from || to;

  return (
    <form
      className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(6.5rem,1fr)_minmax(6.5rem,1fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_auto] lg:items-end"
      onSubmit={applyFilters}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="run-kind">Kind</Label>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger id="run-kind" aria-label="Run kind">
            <SelectValue className="whitespace-nowrap" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kinds</SelectItem>
            {RUN_KINDS.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="run-status">Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger id="run-status" aria-label="Run status">
            <SelectValue className="whitespace-nowrap" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {RUN_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="run-from">From</Label>
        <DatePicker
          id="run-from"
          label="From"
          value={from}
          onChange={setFrom}
          disabled={toDate ? { after: toDate } : undefined}
          invalid={hasInvalidDateRange}
          describedBy={hasInvalidDateRange ? "run-date-range-error" : undefined}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="run-to">To</Label>
        <DatePicker
          id="run-to"
          label="To"
          value={to}
          onChange={setTo}
          disabled={fromDate ? { before: fromDate } : undefined}
          invalid={hasInvalidDateRange}
          describedBy={hasInvalidDateRange ? "run-date-range-error" : undefined}
        />
      </div>
      <div className="flex h-10 items-stretch gap-2 sm:col-span-2 lg:col-span-1 lg:self-end">
        <Button
          type="submit"
          variant="outline"
          className="flex-1 lg:flex-none"
          disabled={hasInvalidDateRange}
        >
          <Filter className="size-3.5" /> Apply
        </Button>
        {hasFilters ? (
          <Button type="button" variant="ghost" onClick={resetFilters}>
            Reset
          </Button>
        ) : null}
      </div>
      {hasInvalidDateRange ? (
        <p
          id="run-date-range-error"
          role="alert"
          className="text-sm text-red-300 sm:col-span-2 lg:col-span-5"
        >
          The “From” date must be on or before the “To” date.
        </p>
      ) : null}
    </form>
  );
}
