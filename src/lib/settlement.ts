// lib/settlement.ts — 拆帳引擎（AC-002，FR-016／FR-017）
//
// 來源：hotel-pm `src/lib/domain.ts` 的 `calculateBreakdown` + `BreakdownRule`（合併清單 #2）。
// 改寫重點：
//   - hotel-pm 用 `ownerRatio`（0–1 小數）；主 repo 的 `Property.ownerShare` 是 0–100 整數百分比。
//     這裡的規則一律吃 `ownerShare`（0–100 整數），由 `ownerShareToRatio` 明確轉換與驗證。
//   - 金額一律為新台幣整數元。比例計算以整數運算（淨收入 × 百分比 ÷ 100）避免浮點誤差。
//   - 四捨五入規則：房東分潤四捨五入到整數元（.5 進位；淨收入為負時以絕對值對稱處理）。
//     業者分潤 = 淨收入 − 房東分潤，尾差固定由業者吸收，確保 房東 + 業者 = 淨收入 恆成立。

export type SettlementRule =
  /** 比例：房東拿淨收入的 ownerShare%。 */
  | { type: "ratio"; ownerShare: number }
  /** 固定：房東拿固定金額（整數元），不超過淨收入。 */
  | { type: "fixed"; ownerAmount: number }
  /**
   * 階梯：依淨收入落在哪一階決定比例。
   * `until` 是該階的上限（含）；淨收入超過所有上限時套用最後一階。
   */
  | { type: "tiered"; tiers: Array<{ until: number; ownerShare: number }> };

export interface SettlementResult {
  /** 淨收入 = 收入 − 支出 */
  netIncome: number;
  /** 房東分潤（整數元） */
  ownerShare: number;
  /** 業者分潤（整數元） */
  operatorShare: number;
  /** 驗算值：恆等於 netIncome，也恆等於 ownerShare + operatorShare */
  checksum: number;
}

/**
 * 把主 repo 的 `ownerShare`（0–100 整數百分比）轉成 0–1 比例。
 * 超出範圍、非整數或非有限數值會拋錯。
 */
export function ownerShareToRatio(ownerShare: number): number {
  assertOwnerShare(ownerShare);
  return ownerShare / 100;
}

function assertOwnerShare(ownerShare: number): void {
  if (!Number.isInteger(ownerShare) || ownerShare < 0 || ownerShare > 100) {
    throw new Error(`ownerShare 必須是 0~100 的整數，收到: ${ownerShare}`);
  }
}

function assertIntegerAmount(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${label}必須是整數元，收到: ${value}`);
  }
}

/** 淨收入 × ownerShare% 四捨五入到整數元（.5 進位，負數對稱）。 */
function roundShare(netIncome: number, ownerShare: number): number {
  const sign = netIncome < 0 ? -1 : 1;
  const rounded = sign * Math.round((Math.abs(netIncome) * ownerShare) / 100);
  return rounded === 0 ? 0 : rounded; // 避免 -0
}

export function calculateBreakdown(params: {
  income: number;
  expenses: number;
  rule: SettlementRule;
}): SettlementResult {
  const { income, expenses, rule } = params;
  if (income < 0) throw new Error("收入不可為負數");
  if (expenses < 0) throw new Error("支出不可為負數");
  assertIntegerAmount(income, "收入");
  assertIntegerAmount(expenses, "支出");

  // 先驗證規則，再計算，避免部分計算後才發現規則無效。
  if (rule.type === "ratio") {
    assertOwnerShare(rule.ownerShare);
  } else if (rule.type === "fixed") {
    if (rule.ownerAmount < 0) throw new Error("固定金額不可為負數");
    assertIntegerAmount(rule.ownerAmount, "固定金額");
  } else {
    if (rule.tiers.length === 0) throw new Error("階梯規則至少需要一階");
    for (const t of rule.tiers) {
      assertOwnerShare(t.ownerShare);
      if (Number.isNaN(t.until)) throw new Error("階梯上限不可為 NaN");
    }
  }

  const netIncome = income - expenses;
  let ownerShare: number;
  if (rule.type === "ratio") {
    ownerShare = roundShare(netIncome, rule.ownerShare);
  } else if (rule.type === "fixed") {
    ownerShare = Math.min(rule.ownerAmount, netIncome);
  } else {
    const sorted = [...rule.tiers].sort((a, b) => a.until - b.until);
    let chosen = sorted[sorted.length - 1].ownerShare;
    for (const tier of sorted) {
      if (netIncome <= tier.until) {
        chosen = tier.ownerShare;
        break;
      }
    }
    ownerShare = roundShare(netIncome, chosen);
  }

  const operatorShare = netIncome - ownerShare;
  return { netIncome, ownerShare, operatorShare, checksum: netIncome };
}
