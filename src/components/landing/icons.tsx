// src/components/landing/icons.tsx
// Inline SVG icons used by the public landing page. Server component —
// no client-only APIs. Stroke-based, currentColor, sized via props.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function HouseIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="m4 11 8-7 8 7v8.5A1.5 1.5 0 0 1 18.5 21h-13A1.5 1.5 0 0 1 4 19.5V11Z" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}
