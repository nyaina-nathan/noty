import Link from "next/link";
import { NotyLogo } from "@/components/noty-logo";

type AuthPlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
};

export function AuthPlaceholder({
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: AuthPlaceholderProps) {
  return (
    <main className="relative flex flex-1 flex-col">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(55% 55% at 50% 0%, #eff6ff 0%, rgba(255,255,255,0) 70%)",
        }}
      />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-6 sm:px-6">
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
        <Link href="/" className="btn btn-secondary">
          Back to home
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 pb-20 pt-6 sm:px-6">
        <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 shadow-[0_20px_50px_-30px_rgba(17,24,39,0.3)] sm:p-10">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">{description}</p>

          <div className="mt-8 flex flex-col gap-3">
            <Link href={primaryHref} className="btn btn-primary w-full">
              {primaryLabel}
            </Link>
            <Link href={secondaryHref} className="btn btn-secondary w-full">
              {secondaryLabel}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
