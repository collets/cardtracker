import Link from "next/link";
import {
  Bell,
  Binoculars,
  LayoutDashboard,
  LogOut,
  Radar,
  Settings,
  Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export function AppNav({ role }: { role: "admin" | "user" }) {
  const links: Array<[string, string, LucideIcon]> = [
    ["/dashboard", "Overview", LayoutDashboard],
    ["/cards", "Discover", Binoculars],
    ["/alerts", "Alerts", Bell],
    ["/settings", "Settings", Settings],
  ];
  if (role === "admin") links.push(["/admin", "Admin", Shield]);

  return (
    <aside className="flex border-b bg-slate-950/70 px-4 py-3 backdrop-blur lg:min-h-screen lg:w-64 lg:flex-col lg:border-r lg:border-b-0 lg:p-5">
      <Link
        href="/dashboard"
        className="mr-6 flex items-center gap-2 font-semibold lg:mr-0 lg:mb-8"
      >
        <span className="grid size-8 place-items-center rounded-lg bg-cyan-300 text-slate-950">
          <Radar className="size-4" />
        </span>
        <span className="hidden sm:inline">Riftwatch</span>
      </Link>
      <nav className="flex flex-1 items-center gap-1 overflow-auto lg:flex-col lg:items-stretch">
        {links.map(([href, label, Icon]) => (
          <Button
            key={href}
            asChild
            variant="ghost"
            className="justify-start text-slate-300"
          >
            <Link href={href}>
              <Icon className="size-4" />{" "}
              <span className="hidden sm:inline">{label}</span>
            </Link>
          </Button>
        ))}
      </nav>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
        className="ml-auto lg:mt-6 lg:ml-0"
      >
        <Button
          type="submit"
          variant="ghost"
          className="w-full justify-start text-slate-400"
        >
          <LogOut className="size-4" />{" "}
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </form>
    </aside>
  );
}
