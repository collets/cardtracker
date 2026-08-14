"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Binoculars,
  CircleUserRound,
  LayoutDashboard,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AttentionCounts } from "@/lib/attention/types";

type NavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const primaryItems: NavigationItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/cards", label: "Discover", icon: Binoculars },
  { href: "/alerts", label: "Alerts", icon: Bell },
];

const adminItem: NavigationItem = {
  href: "/admin",
  label: "Admin",
  icon: Shield,
};

const accountItem: NavigationItem = {
  href: "/settings",
  label: "Account",
  icon: CircleUserRound,
};

export function isNavigationHrefActive(pathname: string, href: string) {
  if (href === "/dashboard" && /^\/watches(?:\/|$)/.test(pathname)) {
    return true;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLink({
  item,
  count,
  attentionLabel,
}: {
  item: NavigationItem;
  count?: number;
  attentionLabel?: string;
}) {
  const pathname = usePathname();
  const active = isNavigationHrefActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Button
      asChild
      variant="ghost"
      className={cn(
        "justify-start text-slate-300 lg:w-full",
        active &&
          "bg-cyan-300/15 text-cyan-100 shadow-sm shadow-cyan-950/20 hover:bg-cyan-300/15 hover:text-cyan-100",
      )}
    >
      <Link
        href={item.href}
        aria-label={item.label}
        aria-description={attentionLabel}
        title={attentionLabel}
        aria-current={active ? "page" : undefined}
      >
        <Icon className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">{item.label}</span>
        {count ? (
          <span className="ml-auto min-w-5 rounded-full bg-cyan-300 px-1.5 py-0.5 text-center text-[10px] leading-4 font-semibold text-slate-950">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}

export function PrimaryNavigation({
  role,
  attention = { unreadDeals: 0, pendingRecommendations: 0, total: 0 },
}: {
  role: "admin" | "user";
  attention?: AttentionCounts;
}) {
  const items = role === "admin" ? [...primaryItems, adminItem] : primaryItems;

  return (
    <nav
      aria-label="Primary navigation"
      className="flex flex-1 items-center gap-1 overflow-auto lg:min-h-0 lg:flex-col lg:items-stretch"
    >
      {items.map((item) => (
        <NavigationLink
          key={item.href}
          item={item}
          count={item.href === "/alerts" ? attention.total : undefined}
          attentionLabel={
            item.href === "/alerts" && attention.total > 0
              ? `Alerts: ${attention.unreadDeals} unread ${attention.unreadDeals === 1 ? "deal" : "deals"}, ${attention.pendingRecommendations} pending ${attention.pendingRecommendations === 1 ? "recommendation" : "recommendations"}`
              : undefined
          }
        />
      ))}
    </nav>
  );
}

export function AccountNavigation() {
  return (
    <nav aria-label="Account navigation">
      <NavigationLink item={accountItem} />
    </nav>
  );
}
