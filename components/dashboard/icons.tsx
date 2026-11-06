import type { SVGProps } from "react";

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

export function NoteIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M4 7a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}

export function TagIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 3 12V5a2 2 0 0 1 2-2h7a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.6Z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m14.5 7.5 2 2" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="m14 6-6 6 6 6" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="m10 6 6 6-6 6" />
    </svg>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

export function LogOutIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 8l-4 4 4 4M6 12h9" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M12 4 2.8 19a1 1 0 0 0 .9 1.5h16.6a1 1 0 0 0 .9-1.5L12 4Z" />
      <path d="M12 10v4M12 17.5v.01" />
    </svg>
  );
}

export function BoldIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M7 5h6a4 4 0 0 1 0 8H7V5Z" />
      <path d="M7 13h7a4 4 0 0 1 0 8H7v-8Z" />
    </svg>
  );
}

export function ItalicIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M10 5h7M7 19h7M14 5l-4 14" />
    </svg>
  );
}

export function UnderlineIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M7 5v7a5 5 0 0 0 10 0V5" />
      <path d="M5 21h14" />
    </svg>
  );
}

export function StrikethroughIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M5 12h14" />
      <path d="M8 8a4 4 0 0 1 8 0" />
      <path d="M8 16a4 4 0 0 0 8 0" />
    </svg>
  );
}

export function BulletListIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1" />
      <circle cx="4.5" cy="12" r="1" />
      <circle cx="4.5" cy="18" r="1" />
    </svg>
  );
}

export function OrderedListIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M10 6h10M10 12h10M10 18h10" />
      <path d="M4 5h1v4M3 9h3M4 14h2l-2 3h2" />
    </svg>
  );
}

export function QuoteIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M5 11h4V7H5v4Zm0 0c0 3 1.5 5 4 6" />
      <path d="M15 11h4V7h-4v4Zm0 0c0 3 1.5 5 4 6" />
    </svg>
  );
}

export function CodeBlockIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="m8 8-4 4 4 4M16 8l4 4-4 4" />
    </svg>
  );
}

export function UndoIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="m8 7-5 5 5 5" />
      <path d="M3 12h10a5 5 0 0 1 5 5" />
    </svg>
  );
}

export function RedoIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="m16 7 5 5-5 5" />
      <path d="M21 12H11a5 5 0 0 0-5 5" />
    </svg>
  );
}

export function EraserIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="m4 15 7-7a2 2 0 0 1 3 0l4 4a2 2 0 0 1 0 3l-4 4H8l-4-4Z" />
      <path d="m9 9 7 7" />
    </svg>
  );
}
