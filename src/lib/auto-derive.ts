import type { Company, FinancialRow, Maybe, Valuation } from "./companies";

type Tone = "good" | "watch" | "neutral";

export type AutoDeriveInput = {
  name: string;
  industry: string;
  financials: FinancialRow[];
  quarterly: FinancialRow[];
  valuation: Valuation;
};

export type AutoDerived = {
  metrics: Company["metrics"];
  ratios: Company["ratios"];
  headline: string;
  oneLine: string;
  grade: string;
  gradeLabel: string;
  score: number;
  report: string[];
  nextQuestions: string[];
};

function pctChange(curr: Maybe<number>, prev: Maybe<number>): Maybe<number> {
  if (curr === null || prev === null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function fmtTrillion(value: Maybe<number>): string {
  if (value === null) return "—";
  const eok = value * 10000;
  if (Math.abs(eok) < 1 && eok !== 0) {
    return `${eok.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}억`;
  }
  return `${Math.round(eok).toLocaleString("ko-KR")}억`;
}

function fmtPct(value: Maybe<number>): string {
  if (value === null) return "—";
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
}

function fmtRatio(value: Maybe<number>): string {
  if (value === null) return "—";
  return `${value.toFixed(1)}배`;
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

function scoreCompany(input: AutoDeriveInput): number {
  const { valuation, financials } = input;
  let s = 50;
  if (valuation.roe !== null) {
    if (valuation.roe > 15) s += 20;
    else if (valuation.roe > 10) s += 12;
    else if (valuation.roe > 5) s += 6;
    else if (valuation.roe < 0) s -= 15;
  }
  if (valuation.debtRatio !== null) {
    if (valuation.debtRatio < 50) s += 15;
    else if (valuation.debtRatio < 100) s += 5;
    else if (valuation.debtRatio < 200) s -= 5;
    else s -= 15;
  }
  if (financials.length >= 2) {
    const last = financials[financials.length - 1];
    const prev = financials[financials.length - 2];
    const yoy = pctChange(last?.revenue ?? null, prev?.revenue ?? null);
    if (yoy !== null) {
      if (yoy > 15) s += 10;
      else if (yoy > 5) s += 5;
      else if (yoy < -10) s -= 10;
      else if (yoy < 0) s -= 5;
    }
    if (last?.margin !== null && last?.margin !== undefined) {
      if (last.margin > 15) s += 5;
      else if (last.margin < 0) s -= 10;
    }
  }
  return Math.round(clamp(s, 0, 100));
}

function gradeFromScore(s: number): { grade: string; label: string } {
  if (s >= 85) return { grade: "A", label: "재무 안전권" };
  if (s >= 75) return { grade: "B+", label: "성장 관찰권" };
  if (s >= 60) return { grade: "B", label: "품질 확인권" };
  if (s >= 45) return { grade: "C", label: "주의 관찰" };
  return { grade: "D", label: "재무 위험권" };
}

export function autoDerive(input: AutoDeriveInput): AutoDerived {
  const { name, industry, financials, valuation } = input;
  const last = financials.length > 0 ? financials[financials.length - 1] : null;
  const prev = financials.length >= 2 ? financials[financials.length - 2] : null;
  const revenueYoY = last && prev ? pctChange(last.revenue, prev.revenue) : null;

  const metrics: Company["metrics"] = [];
  if (last) {
    metrics.push({
      label: "매출",
      value: fmtTrillion(last.revenue),
      change:
        revenueYoY !== null
          ? `전년 대비 ${revenueYoY >= 0 ? "+" : ""}${revenueYoY.toFixed(1)}%`
          : "전년 비교 데이터 없음",
      tone: revenueYoY === null ? "neutral" : revenueYoY > 5 ? "good" : revenueYoY < -5 ? "watch" : "neutral",
    });
    metrics.push({
      label: "영업이익률",
      value: fmtPct(last.margin),
      change:
        last.margin === null
          ? "데이터 없음"
          : last.margin > 15
            ? "두 자릿수 마진"
            : last.margin > 5
              ? "보통 수준"
              : last.margin > 0
                ? "낮은 편"
                : "적자",
      tone: last.margin === null ? "neutral" : last.margin > 10 ? "good" : last.margin > 0 ? "neutral" : "watch",
    });
  }
  if (valuation.debtRatio !== null) {
    metrics.push({
      label: "부채비율",
      value: fmtPct(valuation.debtRatio),
      change:
        valuation.debtRatio < 50
          ? "낮은 편"
          : valuation.debtRatio < 100
            ? "관리 가능"
            : valuation.debtRatio < 200
              ? "관찰권"
              : "높음",
      tone: valuation.debtRatio < 100 ? "good" : valuation.debtRatio < 200 ? "neutral" : "watch",
    });
  }
  if (valuation.roe !== null) {
    metrics.push({
      label: "ROE",
      value: fmtPct(valuation.roe),
      change:
        valuation.roe > 15
          ? "효율 우수"
          : valuation.roe > 5
            ? "양호"
            : valuation.roe > 0
              ? "낮은 편"
              : "적자",
      tone: valuation.roe > 10 ? "good" : valuation.roe > 0 ? "neutral" : "watch",
    });
  }

  const ratios: Company["ratios"] = [];
  if (valuation.roe !== null || (last && last.margin !== null)) {
    const roeScore = valuation.roe !== null ? clamp(valuation.roe * 5, 0, 100) : 50;
    const marginScore = last && last.margin !== null ? clamp(last.margin * 4, 0, 100) : 50;
    const progress = Math.round((roeScore + marginScore) / 2);
    const tone: Tone = progress > 70 ? "good" : progress > 40 ? "neutral" : "watch";
    ratios.push({
      label: "수익성",
      value: progress > 70 ? "강함" : progress > 40 ? "보통" : "주의",
      helper: "ROE와 영업이익률을 같이 봅니다",
      progress,
      tone,
    });
  }
  if (valuation.debtRatio !== null) {
    const progress = Math.round(clamp(100 - valuation.debtRatio / 3, 0, 100));
    const tone: Tone = valuation.debtRatio < 100 ? "good" : valuation.debtRatio < 200 ? "neutral" : "watch";
    ratios.push({
      label: "안정성",
      value: valuation.debtRatio < 100 ? "강함" : valuation.debtRatio < 200 ? "보통" : "주의",
      helper: `부채비율 ${fmtPct(valuation.debtRatio)}`,
      progress,
      tone,
    });
  }
  if (revenueYoY !== null) {
    const progress = Math.round(clamp(50 + revenueYoY * 2, 0, 100));
    const tone: Tone = revenueYoY > 10 ? "good" : revenueYoY > 0 ? "neutral" : "watch";
    ratios.push({
      label: "성장성",
      value: revenueYoY > 10 ? "높음" : revenueYoY > 0 ? "보통" : "둔화",
      helper: `매출 전년 대비 ${revenueYoY >= 0 ? "+" : ""}${revenueYoY.toFixed(1)}%`,
      progress,
      tone,
    });
  }
  if (valuation.per !== null && valuation.per > 0) {
    const per = valuation.per;
    const progress = Math.round(clamp(100 - per * 2, 0, 100));
    const tone: Tone = per < 15 ? "good" : per < 30 ? "neutral" : "watch";
    ratios.push({
      label: "가치(밸류)",
      value: per < 15 ? "저평가권" : per < 30 ? "보통" : "고평가",
      helper: `PER ${fmtRatio(per)}`,
      progress,
      tone,
    });
  }

  const score = scoreCompany(input);
  const { grade, label: gradeLabel } = gradeFromScore(score);

  const headline = industry
    ? `${industry} 종목 — DART 재무 + Yahoo 시세 기반 자동 분석`
    : `${name} — DART 재무 + Yahoo 시세 기반 자동 분석`;

  const oneLineParts: string[] = [];
  if (last?.revenue !== null && last?.revenue !== undefined) {
    oneLineParts.push(`매출 ${fmtTrillion(last.revenue)}`);
  }
  if (last?.margin !== null && last?.margin !== undefined) {
    oneLineParts.push(`영업이익률 ${fmtPct(last.margin)}`);
  }
  if (valuation.roe !== null) oneLineParts.push(`ROE ${fmtPct(valuation.roe)}`);
  if (valuation.debtRatio !== null) oneLineParts.push(`부채비율 ${fmtPct(valuation.debtRatio)}`);
  const oneLine =
    oneLineParts.length > 0
      ? `자동 추출: ${oneLineParts.join(", ")}. 사업 설명·위험·메모는 '수정'에서 보강하세요.`
      : `데이터 수동 입력이 필요합니다. '수정' 버튼으로 채워주세요.`;

  const report: string[] = [];
  if (last) {
    const parts: string[] = [];
    parts.push(
      `${name}의 ${last.period}년 매출은 ${fmtTrillion(last.revenue)}, 영업이익률은 ${fmtPct(last.margin)}입니다.`,
    );
    if (revenueYoY !== null) {
      parts.push(`전년 대비 매출은 ${revenueYoY >= 0 ? "+" : ""}${revenueYoY.toFixed(1)}% 변동했습니다.`);
    }
    report.push(parts.join(" "));
  }
  if (valuation.roe !== null || valuation.debtRatio !== null) {
    const parts: string[] = [];
    if (valuation.roe !== null) parts.push(`ROE는 ${fmtPct(valuation.roe)}`);
    if (valuation.debtRatio !== null) parts.push(`부채비율은 ${fmtPct(valuation.debtRatio)}`);
    report.push(`재무 체력 측면에서 ${parts.join(", ")}입니다.`);
  }
  if (valuation.per !== null || valuation.pbr !== null) {
    const parts: string[] = [];
    if (valuation.per !== null) parts.push(`PER ${fmtRatio(valuation.per)}`);
    if (valuation.pbr !== null) parts.push(`PBR ${fmtRatio(valuation.pbr)}`);
    report.push(`현재 시장 평가는 ${parts.join(", ")} 수준입니다.`);
  }
  report.push("정성 분석(사업 설명·위험·전망)은 '수정' 탭에서 보강해주세요.");

  const nextQuestions: string[] = [];
  if (last?.margin !== null && last?.margin !== undefined && last.margin < 5) {
    nextQuestions.push("영업이익률이 낮은 이유는 무엇이고, 회복 가능성은?");
  }
  if (valuation.debtRatio !== null && valuation.debtRatio > 100) {
    nextQuestions.push("부채비율이 높은데, 이자 부담은 감당 가능한가?");
  }
  if (revenueYoY !== null && revenueYoY < 0) {
    nextQuestions.push("매출 감소의 원인은 일시적인가 구조적인가?");
  }
  if (valuation.per !== null && valuation.per > 30) {
    nextQuestions.push("PER이 높은데, 기대 성장률이 이를 뒷받침하는가?");
  }
  if (valuation.roe !== null && valuation.roe < 0) {
    nextQuestions.push("적자 구조에서 흑자 전환 시점은 언제로 보이는가?");
  }
  if (nextQuestions.length === 0) {
    nextQuestions.push("다음 분기 실적은 시장 기대치를 충족할까?");
    nextQuestions.push("경쟁사 대비 차별화 포인트는 무엇인가?");
    nextQuestions.push("배당·자사주 등 주주환원 정책은 어떤가?");
  }

  return {
    metrics,
    ratios,
    headline,
    oneLine,
    grade,
    gradeLabel,
    score,
    report,
    nextQuestions,
  };
}
