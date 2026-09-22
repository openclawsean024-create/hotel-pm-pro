// components/dashboard/AlertStrip.tsx — top alert strip
"use client";

import { IconAlert } from "./icons";

export function AlertStrip({
  cleaning,
  maintenance,
  openCases,
}: {
  cleaning: number;
  maintenance: number;
  openCases: number;
}) {
  if (cleaning === 0 && maintenance === 0 && openCases === 0) return null;

  const parts: string[] = [];
  if (cleaning > 0) parts.push(`${cleaning} 間待清潔`);
  if (maintenance > 0) parts.push(`${maintenance} 間維修中`);
  if (openCases > 0) parts.push(`${openCases} 件待處理案件`);

  return (
    <div className="alert-strip" role="status" aria-live="polite">
      <span className="alert-icon" aria-hidden="true">
        <IconAlert />
      </span>
      <span className="alert-copy">
        <strong>需要立即處理：</strong>
        {parts.join(" · ")}
      </span>
      <a className="btn-quiet" href="/dashboard/maintenance">
        前往派工單
      </a>
    </div>
  );
}
