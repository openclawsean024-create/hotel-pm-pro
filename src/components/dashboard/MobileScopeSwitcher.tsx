// components/dashboard/MobileScopeSwitcher.tsx
// AC §C7: property switcher for collapsed mobile (<780px). Mirrors the
// desktop Sidebar's `switchProperty` semantics — URL ?propertyId= is the
// single source of truth (page.tsx already re-fetches on URL change).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconBuilding, IconChevron } from "./icons";

type PropertyOption = { id: string; name: string; roomType: string };

export function MobileScopeSwitcher({
  properties,
  activePropertyId,
}: {
  properties: PropertyOption[];
  activePropertyId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const scopeLabel = useMemo(() => {
    if (!activePropertyId) return "全部物業";
    const p = properties.find((x) => x.id === activePropertyId);
    return p?.name ?? "未選擇";
  }, [activePropertyId, properties]);

  function switchProperty(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("propertyId", id);
    else params.delete("propertyId");
    const qs = params.toString();
    router.push(`/dashboard${qs ? `?${qs}` : ""}`);
    setOpen(false);
  }

  // Close on outside click + Escape (keyboard parity with desktop details)
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      const el = containerRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="mobile-scope-switcher"
      data-testid="mobile-scope-switcher"
    >
      <button
        type="button"
        className="mobile-scope-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label="切換物業範圍"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls="mobile-scope-listbox"
      >
        <span className="mobile-scope-avatar" aria-hidden="true">
          {activePropertyId ? "物" : "全"}
        </span>
        <span className="mobile-scope-copy">
          <span className="mobile-scope-label">管理範圍</span>
          <span className="mobile-scope-name">{scopeLabel}</span>
        </span>
        <IconChevron />
      </button>

      {open && (
        <ul
          id="mobile-scope-listbox"
          className="mobile-scope-listbox"
          role="listbox"
          aria-label="物業範圍選項"
        >
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={!activePropertyId}
              aria-current={!activePropertyId ? "true" : undefined}
              className={`mobile-scope-option ${!activePropertyId ? "active" : ""}`}
              onClick={() => switchProperty(null)}
            >
              <span className="mobile-scope-option-icon" aria-hidden="true">
                <IconBuilding />
              </span>
              <span className="mobile-scope-option-name">全部物業</span>
            </button>
          </li>
          {properties.map((p) => {
            const isActive = activePropertyId === p.id;
            return (
              <li role="presentation" key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  aria-current={isActive ? "true" : undefined}
                  className={`mobile-scope-option ${isActive ? "active" : ""}`}
                  onClick={() => switchProperty(p.id)}
                >
                  <span className="mobile-scope-option-icon" aria-hidden="true">
                    <IconBuilding />
                  </span>
                  <span className="mobile-scope-option-name">{p.name}</span>
                  <span className="mobile-scope-option-meta">{p.roomType}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}