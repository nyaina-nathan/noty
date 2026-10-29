type NotyLogoProps = {
  className?: string;
};

export function NotyLogo({ className }: NotyLogoProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M10 11.5h12M10 16h12M10 20.5h7"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
