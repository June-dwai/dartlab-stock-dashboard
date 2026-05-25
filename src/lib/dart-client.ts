import "server-only";

import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

import type { FinancialRow, Maybe } from "./companies";

const DART_BASE = "https://opendart.fss.or.kr/api";
const DART_TIMEOUT_MS = 12_000;
const CORP_CODE_TIMEOUT_MS = 20_000;

export type CorpEntry = {
  corp_code: string;
  corp_name: string;
  stock_code: string;
};

export type DartFsItem = {
  account_id?: string;
  account_nm?: string;
  thstrm_amount?: string;
  frmtrm_amount?: string;
  bfefrmtrm_amount?: string;
  thstrm_nm?: string;
  frmtrm_nm?: string;
  bfefrmtrm_nm?: string;
  sj_div?: string;
  sj_nm?: string;
};

export type DartFiling = {
  report_nm: string;
  rcept_dt: string;
  rcept_no?: string;
  flr_nm?: string;
  pblntf_ty?: string;
  pblntf_detail_ty?: string;
};

export class DartApiError extends Error {
  constructor(message: string, public status?: string) {
    super(message);
    this.name = "DartApiError";
  }
}

function getKey(): string {
  const key = process.env.DART_API_KEY ?? process.env.OPEN_DART_API_KEY;
  if (!key) {
    throw new DartApiError(
      "DART_API_KEY가 설정되지 않았습니다. https://opendart.fss.or.kr 에서 API 키를 발급받아 .env.local에 DART_API_KEY=... 형태로 추가해주세요.",
      "no-key",
    );
  }
  return key;
}

let corpByStock: Map<string, CorpEntry> | null = null;
let corpByName: Map<string, CorpEntry> | null = null;
let corpCachePromise: Promise<void> | null = null;

async function loadCorpCache() {
  if (corpByStock && corpByName) return;
  if (!corpCachePromise) {
    corpCachePromise = (async () => {
      const key = getKey();
      const response = await fetch(`${DART_BASE}/corpCode.xml?crtfc_key=${key}`, {
        next: { revalidate: 60 * 60 * 24 },
        signal: AbortSignal.timeout(CORP_CODE_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new DartApiError(`corpCode 다운로드 실패: HTTP ${response.status}`);
      }
      const buf = await response.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);
      const file = zip.file("CORPCODE.xml");
      if (!file) {
        throw new DartApiError("CORPCODE.xml 항목이 zip에 없습니다.");
      }
      const xml = await file.async("string");
      const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false });
      const parsed = parser.parse(xml) as {
        result?: { list?: CorpEntry | CorpEntry[] };
      };
      const list = parsed?.result?.list ?? [];
      const arr = Array.isArray(list) ? list : [list];

      const byStock = new Map<string, CorpEntry>();
      const byName = new Map<string, CorpEntry>();
      for (const e of arr) {
        const stock = (e.stock_code ?? "").trim();
        const name = (e.corp_name ?? "").trim();
        if (stock) byStock.set(stock, e);
        if (name) byName.set(name, e);
      }
      corpByStock = byStock;
      corpByName = byName;
    })().catch((err) => {
      corpCachePromise = null;
      throw err;
    });
  }
  await corpCachePromise;
}

export async function lookupCorp(query: string): Promise<CorpEntry | null> {
  await loadCorpCache();
  if (!corpByStock || !corpByName) return null;
  const q = query.trim();
  if (!q) return null;

  if (corpByStock.has(q)) return corpByStock.get(q)!;
  if (/^\d+$/.test(q)) {
    const padded = q.padStart(6, "0");
    if (corpByStock.has(padded)) return corpByStock.get(padded)!;
  }
  if (corpByName.has(q)) {
    const hit = corpByName.get(q)!;
    if (hit.stock_code?.trim()) return hit;
  }
  const lowered = q.toLowerCase();
  let bestPartial: CorpEntry | null = null;
  for (const [name, entry] of corpByName.entries()) {
    if (!entry.stock_code?.trim()) continue;
    if (name.toLowerCase().includes(lowered)) {
      bestPartial = entry;
      if (name.toLowerCase() === lowered) return entry;
    }
  }
  return bestPartial;
}

type DartJsonResponse<T> = {
  status: string;
  message: string;
  list?: T[];
} & Record<string, unknown>;

async function callDart<T>(path: string, params: Record<string, string>): Promise<DartJsonResponse<T>> {
  const key = getKey();
  const qs = new URLSearchParams({ crtfc_key: key, ...params }).toString();
  const response = await fetch(`${DART_BASE}/${path}?${qs}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(DART_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new DartApiError(`DART HTTP ${response.status}`);
  }
  const json = (await response.json()) as DartJsonResponse<T>;
  if (json.status && json.status !== "000" && json.status !== "013") {
    throw new DartApiError(`DART ${json.status}: ${json.message ?? ""}`, json.status);
  }
  return json;
}

export type DartCompanyInfo = {
  corp_name?: string;
  stock_name?: string;
  stock_code?: string;
  ceo_nm?: string;
  corp_cls?: string;
  induty_code?: string;
  est_dt?: string;
};

export async function fetchCompanyInfo(corpCode: string): Promise<DartCompanyInfo> {
  const json = await callDart<never>("company.json", { corp_code: corpCode });
  return json as unknown as DartCompanyInfo;
}

export async function fetchFinancialStatements(
  corpCode: string,
  year: number,
  reportCode: "11011" | "11013" | "11012" | "11014",
): Promise<DartFsItem[]> {
  try {
    const json = await callDart<DartFsItem>("fnlttSinglAcntAll.json", {
      corp_code: corpCode,
      bsns_year: String(year),
      reprt_code: reportCode,
      fs_div: "CFS",
    });
    return json.list ?? [];
  } catch (err) {
    if (err instanceof DartApiError && err.status === "013") return [];
    throw err;
  }
}

export async function fetchDisclosures(corpCode: string): Promise<DartFiling[]> {
  const now = new Date();
  const past = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

  try {
    const json = await callDart<DartFiling>("list.json", {
      corp_code: corpCode,
      bgn_de: fmt(past),
      end_de: fmt(now),
      page_count: "20",
    });
    return json.list ?? [];
  } catch (err) {
    if (err instanceof DartApiError && err.status === "013") return [];
    throw err;
  }
}

function parseAmountTrillion(s: string | undefined): Maybe<number> {
  if (s === undefined || s === null) return null;
  const cleaned = String(s).replace(/,/g, "").trim();
  if (!cleaned || cleaned === "-") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n / 1e12;
}

const REV_IDS = ["ifrs-full_Revenue", "ifrs_Revenue"];
const OP_IDS = ["dart_OperatingIncomeLoss"];
const NET_IDS = ["ifrs-full_ProfitLoss", "ifrs_ProfitLoss"];
const DEBT_IDS = ["ifrs-full_Liabilities", "ifrs_Liabilities"];
const EQ_IDS = ["ifrs-full_Equity", "ifrs_Equity"];

function findItem(items: DartFsItem[], ids: string[], names: string[]): DartFsItem | undefined {
  for (const it of items) {
    if (it.account_id && ids.includes(it.account_id)) return it;
  }
  for (const it of items) {
    const nm = it.account_nm ?? "";
    if (names.some((c) => nm.includes(c))) return it;
  }
  return undefined;
}

function row(period: string, rev: Maybe<number>, op: Maybe<number>, net: Maybe<number>): FinancialRow {
  const margin = rev !== null && op !== null && rev !== 0 ? (op / rev) * 100 : null;
  return { period, revenue: rev, operatingProfit: op, netIncome: net, margin };
}

export function mapAnnualFinancials(items: DartFsItem[], baseYear: number): FinancialRow[] {
  const rev = findItem(items, REV_IDS, ["매출액", "영업수익", "수익(매출액)"]);
  const op = findItem(items, OP_IDS, ["영업이익"]);
  const net = findItem(items, NET_IDS, ["당기순이익", "당기순손익"]);

  return [
    row(
      String(baseYear - 2),
      parseAmountTrillion(rev?.bfefrmtrm_amount),
      parseAmountTrillion(op?.bfefrmtrm_amount),
      parseAmountTrillion(net?.bfefrmtrm_amount),
    ),
    row(
      String(baseYear - 1),
      parseAmountTrillion(rev?.frmtrm_amount),
      parseAmountTrillion(op?.frmtrm_amount),
      parseAmountTrillion(net?.frmtrm_amount),
    ),
    row(
      String(baseYear),
      parseAmountTrillion(rev?.thstrm_amount),
      parseAmountTrillion(op?.thstrm_amount),
      parseAmountTrillion(net?.thstrm_amount),
    ),
  ];
}

export function mapQuarterlyRow(
  items: DartFsItem[],
  periodLabel: string,
): FinancialRow {
  const rev = findItem(items, REV_IDS, ["매출액", "영업수익", "수익(매출액)"]);
  const op = findItem(items, OP_IDS, ["영업이익"]);
  const net = findItem(items, NET_IDS, ["당기순이익", "당기순손익"]);
  return row(
    periodLabel,
    parseAmountTrillion(rev?.thstrm_amount),
    parseAmountTrillion(op?.thstrm_amount),
    parseAmountTrillion(net?.thstrm_amount),
  );
}

function emptyQuarter(period: string): FinancialRow {
  return { period, revenue: null, operatingProfit: null, netIncome: null, margin: null };
}

// Q4 = annual − (Q1 + Q2 + Q3). Treats null as "missing" so we don't fabricate values.
function deriveQ4(
  annual: FinancialRow | null,
  q1: FinancialRow,
  q2: FinancialRow,
  q3: FinancialRow,
  period: string,
): FinancialRow {
  if (!annual) return emptyQuarter(period);
  const sub3 = (a: Maybe<number>, b: Maybe<number>, c: Maybe<number>, d: Maybe<number>): Maybe<number> =>
    a === null || b === null || c === null || d === null ? null : a - b - c - d;
  const revenue = sub3(annual.revenue, q1.revenue, q2.revenue, q3.revenue);
  const operatingProfit = sub3(annual.operatingProfit, q1.operatingProfit, q2.operatingProfit, q3.operatingProfit);
  const netIncome = sub3(annual.netIncome, q1.netIncome, q2.netIncome, q3.netIncome);
  const margin =
    revenue !== null && operatingProfit !== null && revenue !== 0
      ? (operatingProfit / revenue) * 100
      : null;
  return { period, revenue, operatingProfit, netIncome, margin };
}

// DART 분기/반기/3분기 보고서의 thstrm_amount는 그 분기 3개월 값입니다 (반기는 Q2 단독, 3분기는 Q3 단독).
// 사업보고서(11011)는 연간 누적이므로 Q4는 (연간 − Q1 − Q2 − Q3)로 계산합니다.
export async function fetchQuartersForYear(
  corpCode: string,
  year: number,
): Promise<FinancialRow[]> {
  const [q1Raw, q2Raw, q3Raw, annualRaw] = await Promise.all([
    fetchFinancialStatements(corpCode, year, "11013").catch(() => [] as DartFsItem[]),
    fetchFinancialStatements(corpCode, year, "11012").catch(() => [] as DartFsItem[]),
    fetchFinancialStatements(corpCode, year, "11014").catch(() => [] as DartFsItem[]),
    fetchFinancialStatements(corpCode, year, "11011").catch(() => [] as DartFsItem[]),
  ]);

  const q1 = q1Raw.length ? mapQuarterlyRow(q1Raw, `${year} Q1`) : emptyQuarter(`${year} Q1`);
  const q2 = q2Raw.length ? mapQuarterlyRow(q2Raw, `${year} Q2`) : emptyQuarter(`${year} Q2`);
  const q3 = q3Raw.length ? mapQuarterlyRow(q3Raw, `${year} Q3`) : emptyQuarter(`${year} Q3`);
  const annual = annualRaw.length ? mapQuarterlyRow(annualRaw, `${year} 연간`) : null;
  const q4 = deriveQ4(annual, q1, q2, q3, `${year} Q4`);

  return [q1, q2, q3, q4];
}

export function deriveValuationFromFs(items: DartFsItem[]): {
  debtRatio: Maybe<number>;
  roe: Maybe<number>;
} {
  const debt = parseAmountTrillion(findItem(items, DEBT_IDS, ["부채총계"])?.thstrm_amount);
  const eq = parseAmountTrillion(findItem(items, EQ_IDS, ["자본총계"])?.thstrm_amount);
  const net = parseAmountTrillion(findItem(items, NET_IDS, ["당기순이익"])?.thstrm_amount);
  const debtRatio = debt !== null && eq !== null && eq !== 0 ? (debt / eq) * 100 : null;
  const roe = net !== null && eq !== null && eq !== 0 ? (net / eq) * 100 : null;
  return { debtRatio, roe };
}

function parseAmountKrw(s: string | undefined): Maybe<number> {
  if (s === undefined || s === null) return null;
  const cleaned = String(s).replace(/,/g, "").trim();
  if (!cleaned || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function extractAbsoluteAmounts(items: DartFsItem[]): {
  netIncomeKrw: Maybe<number>;
  equityKrw: Maybe<number>;
} {
  const net = findItem(items, NET_IDS, ["당기순이익", "당기순손익"]);
  const eq = findItem(items, EQ_IDS, ["자본총계"]);
  return {
    netIncomeKrw: parseAmountKrw(net?.thstrm_amount),
    equityKrw: parseAmountKrw(eq?.thstrm_amount),
  };
}

export function mapFilings(filings: DartFiling[], limit = 6) {
  return filings.slice(0, limit).map((f) => ({
    title: f.report_nm,
    date: f.rcept_dt.replace(/(\d{4})(\d{2})(\d{2})/, "$1.$2.$3"),
    type: f.pblntf_ty || "공시",
    note: f.flr_nm || "",
    url: f.rcept_no ? `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${f.rcept_no}` : undefined,
  }));
}
