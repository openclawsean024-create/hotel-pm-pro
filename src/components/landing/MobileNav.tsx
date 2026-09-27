"use client";

// src/components/landing/MobileNav.tsx
// Sticky-header mobile menu button + slide-down panel.
// Closes on link click and on Escape so hash navigation works cleanly.
// Focus management: when opened, focus moves to the first menu link; when the
// panel closes (Escape, link click, or button toggle), focus is restored to
// the menu button so keyboard users never lose their place.
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Ref } from "react";
import { CloseIcon, MenuIcon } from "./icons";

type NavLink = { href: string; label: string; external?: boolean };

export default function MobileNav({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  // Focus the first link on open; restore focus to the trigger button on close
  // (the cleanup runs on the open→false transition, covering Escape, link
  // click, and the toggle button itself).
  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      firstLinkRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(id);
      buttonRef.current?.focus();
    };
  }, [open]);

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
        ref={buttonRef}
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
        {links.map((link, index) => {
          const isFirst = index === 0;
          const linkRef = isFirst
            ? (firstLinkRef as Ref<HTMLAnchorElement>)
            : undefined;
          if (link.external) {
            return (
              <a
                key={link.href}
                href={link.href}
                ref={linkRef}
                onClick={close}
              >
                {link.label}
              </a>
            );
          }
          return (
            <Link
              key={link.href}
              href={link.href}
              ref={linkRef}
              onClick={close}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
