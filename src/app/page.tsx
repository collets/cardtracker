import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Check,
  ExternalLink,
  Radar,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { auth } from "@/auth";
import { CardArt } from "@/components/card-art";
import { Button } from "@/components/ui/button";

const pageDescription =
  "Track the exact Riftbound card version you want on CardTrader and get notified when a comparable listing becomes a real deal.";

export const metadata: Metadata = {
  title: "Riftbound deal alerts",
  description: pageDescription,
  openGraph: {
    title: "Riftwatch · Riftbound deal alerts",
    description: pageDescription,
    siteName: "Riftwatch",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Riftwatch · Riftbound deal alerts",
    description: pageDescription,
  },
};

const capabilities = [
  {
    icon: Search,
    title: "Compare like with like",
    description:
      "Different sets, artwork, languages, conditions and foil versions are evaluated separately.",
  },
  {
    icon: SlidersHorizontal,
    title: "Decide what counts as a deal",
    description:
      "Combine a percentage discount with minimum savings, then let real market data suggest a more realistic target.",
  },
  {
    icon: BellRing,
    title: "Get notified where it matters",
    description:
      "Review opportunities inside Riftwatch or receive the same evidence directly through Telegram.",
  },
] as const;

const workflow = [
  {
    title: "Discover",
    description:
      "Search the Riftbound catalog and narrow it by set, rarity, artwork, language and foil treatment.",
  },
  {
    title: "Watch",
    description:
      "Choose the card version you want and define which marketplace listings are acceptable.",
  },
  {
    title: "Act",
    description:
      "Receive an evidence-backed alert with the listing price, market reference and CardTrader link.",
  },
] as const;

const guardrails = [
  "EU/EEA seller filters",
  "No automatic purchases",
  "Shipping excluded from deal calculations",
  "Signed, altered and unavailable listings excluded",
] as const;

const featuredCard = {
  name: "Lux - Crownguard",
  expansion: "Vendetta",
  version: "Crystal Rose Alternate Art",
  collectorNumber: "SP6",
  rarity: "Showcase",
  imageUrl:
    "https://cardtrader.com/uploads/blueprints/image/400528/preview_400528-lux-crownguard-crystal-rose-alternate-art-vendetta.webp",
} as const;

export default async function HomePage() {
  const session = await auth();
  const appHref = session ? "/dashboard" : "/sign-in";

  return (
    <main className="overflow-hidden">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <nav className="flex items-center justify-between py-7 sm:py-8">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-lg font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
            aria-label="Riftwatch home"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-950/30">
              <Radar className="size-5" aria-hidden="true" />
            </span>
            <span>Riftwatch</span>
            <span className="hidden rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-cyan-200 uppercase sm:inline-flex">
              Invite-only beta
            </span>
          </Link>
          <Button asChild variant="outline">
            <Link href={appHref}>{session ? "Dashboard" : "Sign in"}</Link>
          </Button>
        </nav>

        <section className="grid items-center gap-14 pt-14 pb-24 sm:pt-20 sm:pb-28 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 lg:pt-24 lg:pb-32">
          <div>
            <p className="mb-5 text-sm font-medium tracking-[0.24em] text-cyan-300 uppercase">
              Riftbound deal alerts
            </p>
            <h1 className="max-w-3xl text-5xl leading-[1.04] font-semibold tracking-tight sm:text-7xl">
              Catch the listing before the market does.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">
              Track the exact Riftbound card version you want—including set,
              artwork, language, condition and foil—and get notified when a
              comparable listing becomes a real deal on CardTrader.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href={appHref}>
                  {session ? "Open dashboard" : "Invited? Sign in"}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
            <p className="mt-5 text-xs leading-5 text-slate-500">
              Designed for CardTrader listings from EU and EEA sellers.
              Riftwatch never places an order for you.
            </p>
          </div>

          <ExampleAlert />
        </section>
      </div>

      <section className="border-y border-white/10 bg-slate-950/30">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-cyan-300 uppercase">
              Built around the card you actually want
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              A low price only matters when the comparison is fair.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, description }) => (
              <article
                key={title}
                className="rounded-2xl border bg-white/[0.035] p-6 transition-[background-color,border-color,box-shadow] hover:border-cyan-300/25 hover:bg-white/[0.055] hover:shadow-lg hover:shadow-cyan-950/10"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-6 font-medium">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="scroll-mt-8"
        aria-labelledby="how-it-works-title"
      >
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-cyan-300 uppercase">
                How it works
              </p>
              <h2
                id="how-it-works-title"
                className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                From catalog search to a useful alert.
              </h2>
              <p className="mt-5 text-sm leading-7 text-slate-400">
                Riftwatch keeps checking accepted marketplace listings while you
                are away and only surfaces opportunities that clear your rules.
              </p>
            </div>
            <ol className="grid gap-4 sm:grid-cols-3">
              {workflow.map(({ title, description }, index) => (
                <li
                  key={title}
                  className="relative rounded-2xl border bg-slate-950/45 p-5"
                >
                  <span className="text-xs font-semibold tracking-[0.18em] text-cyan-300 uppercase">
                    0{index + 1}
                  </span>
                  <h3 className="mt-7 text-lg font-medium">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {description}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-20 rounded-3xl border bg-gradient-to-br from-cyan-300/[0.07] via-slate-950/70 to-purple-400/[0.06] p-6 sm:p-8">
            <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 text-cyan-200">
                  <ShieldCheck className="size-5" aria-hidden="true" />
                  <p className="text-sm font-medium">Clear MVP boundaries</p>
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                  A signal for your decision—not an automated purchase.
                </h2>
              </div>
              <ul className="grid gap-x-8 gap-y-3 text-sm text-slate-300 sm:grid-cols-2">
                {guardrails.map((guardrail) => (
                  <li key={guardrail} className="flex items-start gap-2.5">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-emerald-300"
                      aria-hidden="true"
                    />
                    {guardrail}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-5 py-8 text-xs leading-5 text-slate-500 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>Riftwatch · Invite-only Riftbound marketplace monitoring</p>
            <p>In-app and Telegram alerts based on CardTrader listing data.</p>
          </div>
          <p className="mt-6 max-w-4xl border-t border-white/10 pt-5 text-[11px] text-slate-600">
            Riftwatch is an independent, unofficial service and is not
            affiliated with or endorsed by Riot Games, UVS Games, or CardTrader.
            Riftbound and CardTrader trademarks belong to their respective
            owners.
          </p>
        </div>
      </footer>
    </main>
  );
}

function ExampleAlert() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:mr-0">
      <div
        className="absolute -inset-8 -z-10 rounded-full bg-cyan-400/10 blur-3xl"
        aria-hidden="true"
      />
      <div className="overflow-hidden rounded-3xl border border-white/15 bg-slate-950/80 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="flex flex-col items-start gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-emerald-400/10 text-emerald-300">
              <BellRing className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium">Deal detected</p>
              <p className="text-[11px] text-slate-500">
                Example alert · Illustrative prices
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-emerald-200">
            30% below reference
          </span>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex gap-4">
            <CardArt
              src={featuredCard.imageUrl}
              alt={`${featuredCard.name}, ${featuredCard.version}`}
              sizes="80px"
              className="h-28 w-20 shrink-0 rounded-lg border border-white/10 shadow-inner"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{featuredCard.name}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-cyan-200">
                {featuredCard.expansion} · {featuredCard.version}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-slate-300">
                <span className="rounded-full bg-cyan-300/10 px-2 py-1 text-cyan-100">
                  {featuredCard.rarity}
                </span>
                <span className="rounded-full bg-white/[0.07] px-2 py-1">
                  #{featuredCard.collectorNumber}
                </span>
                <span className="rounded-full bg-white/[0.07] px-2 py-1">
                  English
                </span>
                <span className="rounded-full bg-white/[0.07] px-2 py-1">
                  Near Mint
                </span>
              </div>
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <div>
              <dt className="text-[10px] tracking-wide text-slate-500 uppercase">
                Listing
              </dt>
              <dd className="mt-1 text-lg font-semibold text-emerald-300 tabular-nums">
                €29.90
              </dd>
            </div>
            <div>
              <dt className="text-[10px] tracking-wide text-slate-500 uppercase">
                Reference
              </dt>
              <dd className="mt-1 text-lg font-medium text-slate-200 tabular-nums">
                €42.80
              </dd>
            </div>
            <div>
              <dt className="text-[10px] tracking-wide text-slate-500 uppercase">
                You save
              </dt>
              <dd className="mt-1 text-lg font-medium text-cyan-200 tabular-nums">
                €12.90
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-cyan-300/10 px-4 py-3 text-xs text-cyan-100">
            <span className="flex items-center gap-2">
              <ExternalLink className="size-3.5" aria-hidden="true" />
              CardTrader listing link included
            </span>
            <span className="shrink-0">Seller: IT</span>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-white/10 bg-white/[0.025] px-5 py-4 text-xs text-slate-400">
          <Send className="size-4 text-cyan-300" aria-hidden="true" />
          Riftwatch sends the price, savings, and CardTrader link straight to
          Telegram.
        </div>
      </div>
    </div>
  );
}
