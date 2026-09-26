"use client";

// src/components/landing/MobileNav.tsx
// Sticky-header mobile menu button + slide-down panel.
// Closes on link click and on Escape so hash navigation works cleanly.
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { CloseIcon, MenuIcon } from "./icons";

type NavLink = { href: string; label: string; external?: boolean };

export default function MobileNav({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        className="landing-menu-btn"
        aria-label={open ? "關閉導覽" : "開啟導覽"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>
      <nav
        id={panelId}
        aria-label="行動導覽"
        className={`landing-mobile-nav${open ? " open" : ""}`}
      >
        {links.map((link) =>
          link.external ? (
            <a key={link.href} href={link.href} onClick={close}>
              {link.label}
            </a>
          ) : (
            <Link key={link.href} href={link.href} onClick={close}>
              {link.label}
            </Link>
          ),
        )}
      </nav>
    </>
  );
}
