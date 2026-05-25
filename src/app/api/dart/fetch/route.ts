import { NextRequest, NextResponse } from "next/server";

import { autoDerive } from "@/lib/auto-derive";
import type { FinancialRow } from "@/lib/companies";
import {
  DartApiError,
  deriveValuationFromFs,
  extractAbsoluteAmounts,
  fetchCompanyInfo,
  fetchDisclosures,
  fetchFinancialStatements,
  fetchQuartersForYear,
  lookupCorp,
  mapAnnualFinancials,
  mapFilings,
  mapQuarterlyRow,
} from "@/lib/dart-client";
import { fetchNaverInvestor } from "@/lib/naver-investor";
import { fetchYahooQuote } from "@/lib/yahoo-finance";

export const dynamic = "force-dynamic";

const MARKET_LABEL: Record<string, string> = {
  Y: "KOSPI",
  K: "KOSDAQ",
  N: "KONEX",
  E: "기타",
};

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim();
  if (!query) {
    return NextResponse.json({ error: "query 파라미터가 필요합니다." }, { status: 400 });
  }

  try {
    const corp = await lookupCorp(query);
    if (!corp) {
      return NextResponse.json(
        { error: `'${query}'와 일치하는 상장 기업을 DART에서 찾지 못했습니다.` },
        { status: 404 },
      );
    }

    const corpCode = corp.corp_code;
    const today = new Date();
    const latestAnnualYear = today.getMonth() >= 3 ? today.getFullYear() - 1 : today.getFullYear() - 2;
    const currentYear = today.getFullYear();

    const [
      companyInfo,
      annualPrimary,
      annualFallback,
      annualOlder,
      lastYearQuarters,
      currentQ1Items,
      filings,
    ] = await Promise.all([
      fetchCompanyInfo(corpCode).catch(() => null),
      fetchFinancialStatements(corpCode, latestAnnualYear, "11011").catch(() => []),
      fetchFinancialStatements(corpCode, latestAnnualYear - 1, "11011").catch(() => []),
      fetchFinancialStatements(corpCode, latestAnnualYear - 2, "11011").catch(() => []),
      fetchQuartersForYear(corpCode, latestAnnualYear).catch(() => []),
      fetchFinancialStatements(corpCode, currentYear, "11013").catch(() => []),
      fetchDisclosures(corpCode).catch(() => []),
    ]);

    const annualItems = annualPrimary.length > 0 ? annualPrimary : annualFallback;
    const annualBaseYear = annualPrimary.length > 0 ? latestAnnualYear : latestAnnualYear - 1;

    const recentFinancials = annualItems.length
      ? mapAnnualFinancials(annualItems, annualBaseYear)
      : [];
    const olderFinancials = annualOlder.length
      ? mapAnnualFinancials(annualOlder, annualBaseYear - 2)
      : [];
    const byPeriod = new Map<string, FinancialRow>();
    for (const r of olderFinancials) byPeriod.set(r.period, r);
    for (const r of recentFinancials) byPeriod.set(r.period, r);
    const financials = Array.from(byPeriod.values())
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-4);

    const currentQ1 = currentQ1Items.length
      ? mapQuarterlyRow(currentQ1Items, `${currentYear} Q1`)
      : null;
    const quarterly = [
      ...lastYearQuarters,
      ...(currentQ1 ? [currentQ1] : []),
    ];
    const valuationDerived = annualItems.length ? deriveValuationFromFs(annualItems) : { debtRatio: null, roe: null };
    const mappedFilings = mapFilings(filings);

    const market =
      companyInfo?.corp_cls && MARKET_LABEL[companyInfo.corp_cls]
        ? MARKET_LABEL[companyInfo.corp_cls]
        : "KOSPI";

    const stockCode = corp.stock_code?.trim() || "";
    const [yahooQuote, investorActivity] = await Promise.all([
      stockCode ? fetchYahooQuote(stockCode, market).catch(() => null) : Promise.resolve(null),
      stockCode ? fetchNaverInvestor(stockCode).catch(() => null) : Promise.resolve(null),
    ]);
    const yahooAsOf = yahooQuote?.asOf;
    const fallbackAsOf = today.toISOString().slice(0, 10).replace(/-/g, ".");

    const absolutes = annualItems.length ? extractAbsoluteAmounts(annualItems) : { netIncomeKrw: null, equityKrw: null };
    const marketCap = yahooQuote?.marketCap ?? null;
    const yahooPer = yahooQuote?.per ?? null;
    const yahooPbr = yahooQuote?.pbr ?? null;
    const computedPer =
      yahooPer ??
      (marketCap !== null && absolutes.netIncomeKrw !== null && absolutes.netIncomeKrw > 0
        ? marketCap / absolutes.netIncomeKrw
        : null);
    const computedPbr =
      yahooPbr ??
      (marketCap !== null && absolutes.equityKrw !== null && absolutes.equityKrw > 0
        ? marketCap / absolutes.equityKrw
        : null);

    const industryText = companyInfo?.induty_code ? `업종코드 ${companyInfo.induty_code}` : "";
    const valuation = {
      per: computedPer,
      pbr: computedPbr,
      roe: valuationDerived.roe,
      debtRatio: valuationDerived.debtRatio,
      asOf: yahooAsOf ?? fallbackAsOf,
    };
    const derived = autoDerive({
      name: corp.corp_name,
      industry: industryText,
      financials,
      quarterly,
      valuation,
    });

    const result = {
      source: yahooQuote ? "dart+yahoo" : "dart",
      corp: {
        corpCode: corp.corp_code,
        corpName: corp.corp_name,
        stockCode: corp.stock_code,
      },
      partial: {
        ticker: stockCode,
        name: corp.corp_name,
        corpCode: corp.corp_code,
        market,
        industry: industryText,
        headline: derived.headline,
        oneLine: derived.oneLine,
        grade: derived.grade,
        gradeLabel: derived.gradeLabel,
        score: derived.score,
        updatedAt: yahooAsOf ?? fallbackAsOf,
        valuation,
        financials,
        quarterly,
        filings: mappedFilings,
        metrics: derived.metrics,
        ratios: derived.ratios,
        report: derived.report,
        nextQuestions: derived.nextQuestions,
        investorActivity,
      },
      yahoo: yahooQuote
        ? {
            price: yahooQuote.price,
            currency: yahooQuote.currency,
            marketCap: yahooQuote.marketCap,
            symbol: yahooQuote.symbol,
            asOf: yahooQuote.asOf,
          }
        : null,
      warnings: [
        ...(financials.length === 0 ? ["연간 재무제표 자동 추출 실패"] : []),
        ...(lastYearQuarters.length === 0
          ? [`${latestAnnualYear}년 분기 재무제표 자동 추출 실패`]
          : lastYearQuarters.some((q) => q.revenue === null)
            ? [`${latestAnnualYear}년 일부 분기 데이터 미공시 (반기·3분기·사업보고서 중 빠진 게 있어 차감 계산 불가)`]
            : []),
        ...(!currentQ1 ? [`${currentYear} Q1 재무제표 미공시 또는 추출 실패`] : []),
        ...(mappedFilings.length === 0 ? ["최근 공시 목록 없음"] : []),
        ...(!investorActivity
          ? ["외국인·기관 수급 데이터 추출 실패 (Naver 증권 페이지 변경 가능성)"]
          : ["수급은 Naver 증권 기준. '기관'에 연기금 포함 — 단독 분리 안 됨."]),
        ...(!yahooQuote
          ? ["Yahoo Finance에서 주가/시가총액을 가져오지 못했습니다 — PER·PBR 수동 입력 필요."]
          : computedPer === null && computedPbr === null
            ? ["시가총액 또는 DART 순이익/자본총계 부족으로 PER·PBR 계산 불가."]
            : yahooPer === null && yahooPbr === null && (computedPer !== null || computedPbr !== null)
              ? ["PER·PBR은 Yahoo 시가총액 ÷ DART 순이익/자본총계로 직접 계산했습니다."]
              : []),
      ],
    };

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof DartApiError ? err.message : `알 수 없는 오류: ${String(err)}`;
    const status = err instanceof DartApiError && err.status === "no-key" ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
