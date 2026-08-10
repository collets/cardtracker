import Link from "next/link";
import { ArrowRight, BellRing, LineChart, Radar } from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await auth();
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
      <nav className="flex items-center justify-between">
        <div className="flex items-center gap-3 font-semibold tracking-tight">
          <span className="grid size-9 place-items-center rounded-xl bg-cyan-300 text-slate-950">
            <Radar className="size-5" />
          </span>
          Riftwatch
        </div>
        <Button asChild variant="outline">
          <Link href={session ? "/dashboard" : "/sign-in"}>
            {session ? "Dashboard" : "Sign in"}
          </Link>
        </Button>
      </nav>
      <section className="grid flex-1 items-center gap-16 py-20 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="mb-5 text-sm font-medium tracking-[0.24em] text-cyan-300 uppercase">
            Riftbound market intelligence
          </p>
          <h1 className="max-w-3xl text-5xl leading-[1.05] font-semibold tracking-tight sm:text-7xl">
            Catch the listing before the market does.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">
            Track exact card variants, compare like-for-like listings, and get
            notified when a real opportunity appears on CardTrader.
          </p>
          <Button asChild size="lg" className="mt-9">
            <Link href={session ? "/dashboard" : "/sign-in"}>
              Open Riftwatch <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-4">
          {[
            [
              LineChart,
              "Comparable pricing",
              "Variants, condition, language and seller region stay separate.",
            ],
            [
              BellRing,
              "Actionable alerts",
              "A price must clear both relative and absolute savings thresholds.",
            ],
            [
              Radar,
              "Five-minute monitoring",
              "One marketplace fetch serves every user watching the same card.",
            ],
          ].map(([Icon, title, description]) => {
            const FeatureIcon = Icon as typeof Radar;
            return (
              <div
                key={String(title)}
                className="rounded-2xl border bg-white/[0.035] p-5 backdrop-blur"
              >
                <FeatureIcon className="mb-5 size-5 text-cyan-300" />
                <h2 className="font-medium">{String(title)}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {String(description)}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
