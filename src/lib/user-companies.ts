import type { Company } from "./companies";

const STORAGE_KEY = "dartlab:user-companies";

function today() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, ".");
}

export function loadUserCompanies(): Company[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Company[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUserCompanies(companies: Company[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(companies));
  } catch {}
}

export function upsertUserCompany(company: Company): Company[] {
  const list = loadUserCompanies();
  const idx = list.findIndex((c) => c.ticker === company.ticker);
  const next =
    idx >= 0
      ? list.map((c, i) => (i === idx ? company : c))
      : [...list, company];
  saveUserCompanies(next);
  return next;
}

export function deleteUserCompany(ticker: string): Company[] {
  const next = loadUserCompanies().filter((c) => c.ticker !== ticker);
  saveUserCompanies(next);
  return next;
}

export function createEmptyCompany(overrides: Partial<Company> = {}): Company {
  const t = today();
  return {
    ticker: "",
    name: "",
    market: "KOSPI",
    industry: "",
    headline: "",
    oneLine: "",
    updatedAt: t,
    grade: "—",
    gradeLabel: "데이터 확인 중",
    score: 0,
    metrics: [],
    valuation: {
      per: null,
      pbr: null,
      roe: null,
      debtRatio: null,
      asOf: t,
    },
    financials: [
      { period: "2022", revenue: null, operatingProfit: null, netIncome: null, margin: null },
      { period: "2023", revenue: null, operatingProfit: null, netIncome: null, margin: null },
      { period: "2024", revenue: null, operatingProfit: null, netIncome: null, margin: null },
      { period: "2025", revenue: null, operatingProfit: null, netIncome: null, margin: null },
    ],
    quarterly: [
      { period: "2025 Q1", revenue: null, operatingProfit: null, netIncome: null, margin: null },
      { period: "2025 Q2", revenue: null, operatingProfit: null, netIncome: null, margin: null },
      { period: "2025 Q3", revenue: null, operatingProfit: null, netIncome: null, margin: null },
      { period: "2025 Q4", revenue: null, operatingProfit: null, netIncome: null, margin: null },
      { period: "2026 Q1", revenue: null, operatingProfit: null, netIncome: null, margin: null },
    ],
    ratios: [],
    specialNotes: [],
    schedule: [],
    external: [],
    business: [],
    filings: [],
    risks: [],
    report: [],
    nextQuestions: [],
    ...overrides,
  };
}

export function isUserCompany(ticker: string, builtInTickers: Set<string>): boolean {
  return !builtInTickers.has(ticker);
}
