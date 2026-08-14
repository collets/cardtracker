import Link from "next/link";
import { LogOut, Radar } from "lucide-react";
import { signOut } from "@/auth";
import {
  AccountNavigation,
  PrimaryNavigation,
} from "@/components/app-nav-links";
import { Button } from "@/components/ui/button";
import { getAttentionCounts } from "@/lib/attention/counts";

export async function AppNav({
  role,
  userId,
}: {
  role: "admin" | "user";
  userId: string;
}) {
  const attention = await getAttentionCounts(userId);

  return (
    <aside className="flex border-b bg-slate-950/70 px-4 py-3 backdrop-blur lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col lg:self-start lg:overflow-hidden lg:border-r lg:border-b-0 lg:p-5">
      <Link
        href="/dashboard"
        aria-label="Riftwatch home"
        className="mr-6 flex shrink-0 items-center gap-2 font-semibold lg:mr-0 lg:mb-8"
      >
        <span className="grid size-8 place-items-center rounded-lg bg-cyan-300 text-slate-950">
          <Radar className="size-4" />
        </span>
        <span className="hidden sm:inline">Riftwatch</span>
      </Link>
      <PrimaryNavigation role={role} attention={attention} />
      <div className="ml-auto flex shrink-0 items-center gap-1 lg:mt-auto lg:ml-0 lg:flex-col lg:items-stretch lg:border-t lg:pt-4">
        <AccountNavigation />
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start text-slate-400"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </form>
      </div>
    </aside>
  );
}
