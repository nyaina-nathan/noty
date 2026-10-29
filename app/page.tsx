import type { ComponentType, SVGProps } from "react";
import Link from "next/link";
import { NotyLogo } from "@/components/noty-logo";

type IconProps = SVGProps<SVGSVGElement>;

function iconProps(props: IconProps) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

function CheckIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

function LayersIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 16 9 5 9-5" />
    </svg>
  );
}

function FolderIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M4 7a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}

function TagIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 3 12V5a2 2 0 0 1 2-2h7a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.6Z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  );
}

function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

const capabilities = [
  "Projects that group related notes",
  "Sections you can reorder",
  "Tags and filters that work",
  "Private, password-protected accounts",
];

const features: {
  title: string;
  description: string;
  icon: ComponentType<IconProps>;
}[] = [
  {
    title: "Notes with real structure",
    description:
      "Write in focused sections instead of one endless page. Reorder the parts as your thinking changes.",
    icon: LayersIcon,
  },
  {
    title: "Projects keep the context",
    description:
      "Group research, drafts, and decisions under a project so everything about a topic lives together.",
    icon: FolderIcon,
  },
  {
    title: "Tags that actually help",
    description:
      "Tag notes and filter by project or tag. The note you need is a click away, not buried in a list.",
    icon: TagIcon,
  },
];

const steps = [
  {
    number: "01",
    title: "Create your account",
    description:
      "Sign up with a username, email, and password. No setup wizard, no credit card.",
  },
  {
    number: "02",
    title: "Start a project",
    description:
      "Name the project, add a tag, then write your first note inside it.",
  },
  {
    number: "03",
    title: "Write and find it later",
    description:
      "Break notes into sections, tag them, and filter your list when you need something.",
  },
];

export default function Home() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-50 border-b border-line/80 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md"
            aria-label="noty home"
          >
            <NotyLogo className="h-8 w-8" />
            <span className="font-display text-xl font-semibold tracking-tight">
              noty
            </span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
            <a
              href="#features"
              className="py-3 text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="py-3 text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              How it works
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              Log in
            </Link>
            <Link href="/register" className="btn btn-primary">
              Start free
            </Link>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem]"
            style={{
              backgroundImage:
                "radial-gradient(60% 65% at 50% 0%, #eff6ff 0%, rgba(255,255,255,0) 72%)",
            }}
          />

          <div className="mx-auto grid w-full max-w-6xl items-center gap-16 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:pb-28 lg:pt-24">
            <div>
              <p className="eyebrow">Notes, minus the clutter</p>
              <h1 className="mt-4 max-w-xl font-display text-4xl font-semibold leading-[1.1] tracking-tight text-balance sm:text-5xl">
                Turn scattered thoughts into{" "}
                <span className="text-primary">clear, organized notes.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
                noty keeps every idea, draft, and reference in one calm place —
                sorted by project and section, tagged so you can find it later.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className="btn btn-primary">
                  Create your free account
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <a href="#how-it-works" className="btn btn-secondary">
                  See how it works
                </a>
              </div>

              <p className="mt-4 text-sm text-muted">
                Free to use. No credit card. Takes about a minute.
              </p>
            </div>

            <NotesPreview />
          </div>
        </section>

        {/* Capabilities strip */}
        <section aria-label="What noty includes" className="border-y border-line bg-mist">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
            <ul className="grid gap-3 text-sm text-muted sm:grid-cols-2 sm:gap-x-8 lg:flex lg:items-center lg:justify-between">
              {capabilities.map((capability) => (
                <li key={capability} className="flex items-center gap-2">
                  <CheckIcon className="h-4 w-4 shrink-0 text-success" />
                  <span>{capability}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          aria-labelledby="features-heading"
          className="scroll-mt-20"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
            <div className="max-w-2xl">
              <p className="eyebrow">Why noty</p>
              <h2
                id="features-heading"
                className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
              >
                A workspace that stays out of your way
              </h2>
              <p className="mt-4 text-base leading-7 text-muted">
                Enough structure to keep things findable, without turning
                note-taking into a project of its own.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {features.map(({ title, description, icon: Icon }) => (
                <article
                  key={title}
                  className="rounded-xl border border-line bg-surface p-6 transition-colors hover:border-primary/40"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary-strong">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-semibold">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          aria-labelledby="how-it-works-heading"
          className="scroll-mt-20 border-y border-line bg-mist"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
            <div className="max-w-2xl">
              <p className="eyebrow">How it works</p>
              <h2
                id="how-it-works-heading"
                className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
              >
                From blank page to findable note in three steps
              </h2>
            </div>

            <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
              {steps.map((step) => (
                <li key={step.number} className="border-t border-line pt-6">
                  <span className="font-mono text-xs font-semibold tracking-[0.18em] text-primary-strong">
                    {step.number}
                  </span>
                  <h3 className="mt-3 font-display text-lg font-semibold">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Final CTA */}
        <section aria-labelledby="cta-heading">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
            <div className="rounded-2xl bg-ink px-6 py-14 text-center sm:px-12">
              <h2
                id="cta-heading"
                className="mx-auto max-w-xl font-display text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl"
              >
                Your next idea deserves a better home.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-base leading-7 text-white/70">
                Create a free account and start your first note in a minute.
              </p>
              <div className="mt-8 flex flex-col items-center gap-4">
                <Link
                  href="/register"
                  className="btn btn-light w-full sm:w-auto"
                >
                  Create your free account
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <p className="text-sm text-white/60">
                  Already have an account?{" "}
                  <Link
                    href="/login"
                    className="font-medium text-white underline underline-offset-4"
                  >
                    Log in
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2">
            <NotyLogo className="h-6 w-6" />
            <span className="font-display text-base font-semibold">noty</span>
            <span className="ml-2 text-sm text-muted">Notes, minus the clutter.</span>
          </div>
          <nav aria-label="Footer" className="flex items-center gap-6 text-sm">
            <a
              href="#features"
              className="py-3 text-muted transition-colors hover:text-ink"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="py-3 text-muted transition-colors hover:text-ink"
            >
              How it works
            </a>
            <Link
              href="/login"
              className="py-3 text-muted transition-colors hover:text-ink"
            >
              Log in
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}

function NotesPreview() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto w-full max-w-md select-none"
    >
      <div className="absolute -inset-8 -z-10 rounded-[2.5rem] bg-gradient-to-br from-primary/10 via-secondary/10 to-transparent" />

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_30px_70px_-30px_rgba(17,24,39,0.35)]">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <NotyLogo className="h-5 w-5" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Workspace
            </span>
          </div>
          <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
            All changes saved
          </span>
        </div>

        <div className="grid grid-cols-[96px_1fr] sm:grid-cols-[112px_1fr]">
          <div className="border-r border-line bg-mist p-3">
            <p className="px-1 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
              Projects
            </p>
            <ul className="mt-2 space-y-1 text-[11px]">
              <li className="flex items-center gap-1.5 rounded-md bg-primary/10 px-1.5 py-1 font-medium text-primary-strong">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Product
              </li>
              <li className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
                Research
              </li>
              <li className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                Personal
              </li>
            </ul>
          </div>

          <div className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="font-display text-sm font-semibold text-ink">
                Q4 launch notes
              </p>
              <span className="mt-0.5 h-6 w-6 shrink-0 rounded-md border border-line bg-mist" />
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="chip">planning</span>
              <span className="chip">product</span>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-[11px] font-medium text-ink">Overview</p>
                <div className="mt-2 space-y-1.5">
                  <div className="h-1.5 w-full rounded-full bg-line" />
                  <div className="h-1.5 w-11/12 rounded-full bg-line" />
                  <div className="h-1.5 w-8/12 rounded-full bg-line" />
                </div>
              </div>

              <div>
                <p className="text-[11px] font-medium text-ink">Next steps</p>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="grid h-3.5 w-3.5 place-items-center rounded-[4px] bg-success/15 text-success">
                      <CheckIcon className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    <div className="h-1.5 w-9/12 rounded-full bg-line" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-[4px] border border-line" />
                    <div className="h-1.5 w-7/12 rounded-full bg-line" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-5 -left-4 hidden items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 shadow-lg sm:flex">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-success/10 text-success">
          <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
        <span className="text-[11px] font-medium text-ink">
          Section reordered
        </span>
      </div>
    </div>
  );
}
