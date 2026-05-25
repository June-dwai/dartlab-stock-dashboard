"use client";

import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  Database,
  Download,
  FileText,
  Globe2,
  LineChart,
  MessageSquare,
  Minus,
  NotebookPen,
  Pencil,
  Percent,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CompanyForm } from "@/components/company-form";
import { TradingViewMiniChart } from "@/components/tradingview-chart";
import type { Company, InvestorActivity, Maybe, Risk, SpecialNote } from "@/lib/companies";
import { SAMPLE_STOCKS } from "@/lib/sample-stocks";
import { resolveSuggestedTheme, suggestTheme } from "@/lib/theme-classifier";
import {
  createEmptyCompany,
  deleteUserCompany,
  loadUserCompanies,
  saveUserCompanies,
  upsertUserCompany,
} from "@/lib/user-companies";
import {
  ALL_THEME_ID,
  UNCATEGORIZED_THEME_ID,
  genThemeId,
  loadCompanyThemes,
  loadThemes,
  pruneMappingForThemes,
  saveCompanyThemes,
  saveThemes,
  type Theme,
} from "@/lib/themes";

type TabId = "summary" | "finance" | "business" | "risk" | "report";

const tabs: { id: TabId; label: string }[] = [
  { id: "summary", label: "한눈에" },
  { id: "finance", label: "재무제표" },
  { id: "business", label: "사업·외부" },
  { id: "risk", label: "위험" },
  { id: "report", label: "보고서" },
];

const toneClass = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-900",
  neutral: "border-zinc-200 bg-white text-zinc-900",
  watch: "border-amber-200 bg-amber-50 text-amber-950",
};

const progressClass = {
  good: "bg-emerald-500",
  neutral: "bg-cyan-500",
  watch: "bg-amber-500",
};

const riskClass: Record<Risk["level"], string> = {
  낮음: "border-emerald-200 bg-emerald-50 text-emerald-900",
  보통: "border-amber-200 bg-amber-50 text-amber-950",
  높음: "border-rose-200 bg-rose-50 text-rose-950",
};

const categoryClass: Record<string, string> = {
  라이센스: "bg-violet-100 text-violet-900",
  지분: "bg-sky-100 text-sky-900",
  공급계약: "bg-emerald-100 text-emerald-900",
  주주환원: "bg-amber-100 text-amber-900",
  자사주: "bg-rose-100 text-rose-900",
  기타: "bg-zinc-100 text-zinc-800",
  "제품 리뷰": "bg-cyan-100 text-cyan-900",
  시승기: "bg-cyan-100 text-cyan-900",
  사용기: "bg-cyan-100 text-cyan-900",
  "시장 전망": "bg-indigo-100 text-indigo-900",
  "임상·분석": "bg-fuchsia-100 text-fuchsia-900",
};

const NOTE_CATEGORIES: SpecialNote["category"][] = [
  "라이센스",
  "지분",
  "공급계약",
  "주주환원",
  "자사주",
  "기타",
];

function formatTrillion(value: Maybe<number>) {
  if (value === null) return "NA";
  const eok = value * 10000;
  if (Math.abs(eok) < 1 && eok !== 0) {
    return `${eok.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}억`;
  }
  return `${Math.round(eok).toLocaleString("ko-KR")}억`;
}

function formatPercent(value: Maybe<number>) {
  if (value === null) return "NA";
  return `${value.toLocaleString("ko-KR", {
    maximumFractionDigits: 1,
  })}%`;
}

function formatRatio(value: Maybe<number>, suffix = "배") {
  if (value === null) return "NA";
  return `${value.toFixed(1)}${suffix}`;
}

function computeYoY(curr: Maybe<number>, prev: Maybe<number>): Maybe<number> {
  if (curr === null || prev === null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

type InvestorEntry =
  | { status: "loading" }
  | { status: "ready"; data: InvestorActivity; fetchedAt: string }
  | { status: "error"; message: string };

const GRADE_RANK: Record<string, number> = {
  "A+": 0,
  A: 1,
  "B+": 2,
  B: 3,
  "C+": 4,
  C: 5,
  D: 6,
};

function gradeRank(grade: string): number {
  return GRADE_RANK[grade] ?? 99;
}

function dartCompanyUrl(company: Company): string {
  if (company.corpCode) {
    // 8-digit corp_code → DART 회사별 공시 검색 (정확)
    return `https://dart.fss.or.kr/dsab001/main.do?selectKey=&textCrpCik=${company.corpCode}`;
  }
  // Fallback: 회사명으로 검색
  return `https://dart.fss.or.kr/dsab001/main.do?textCrpNm=${encodeURIComponent(company.name)}`;
}

function EmptyHint({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-sm text-zinc-500">
      {message}
    </div>
  );
}

function ThemePill({
  label,
  count,
  active,
  muted = false,
  onClick,
  onDelete,
}: {
  label: string;
  count: number;
  active: boolean;
  muted?: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const base = "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition";
  const tone = active
    ? "border-emerald-500 bg-emerald-600 text-white"
    : muted
      ? "border-zinc-200 bg-zinc-50 text-zinc-500 hover:bg-zinc-100"
      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50";
  return (
    <span className="inline-flex items-center">
      <button type="button" onClick={onClick} className={`${base} ${tone}`}>
        {label}
        <span className={`text-[10px] font-mono ${active ? "text-emerald-100" : "text-zinc-500"}`}>
          {count}
        </span>
      </button>
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`${label} 테마 삭제`}
          className="ml-0.5 rounded-full p-0.5 text-zinc-400 hover:bg-rose-100 hover:text-rose-700"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
}

export function CompanyDashboard({ companies }: { companies: Company[] }) {
  const builtIn = companies;

  const [userCompanies, setUserCompanies] = useState<Company[]>([]);
  const userTickers = useMemo(
    () => new Set(userCompanies.map((c) => c.ticker)),
    [userCompanies],
  );
  // User company wins if same ticker — refreshed data overrides built-in skeleton
  const allCompanies = useMemo(
    () => [
      ...builtIn.filter((c) => !userTickers.has(c.ticker)),
      ...userCompanies,
    ],
    [builtIn, userCompanies, userTickers],
  );

  const [selectedTicker, setSelectedTicker] = useState(builtIn[0]?.ticker ?? "");
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [userNotes, setUserNotes] = useState<SpecialNote[]>([]);
  const [memo, setMemo] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [formInitial, setFormInitial] = useState<Company>(() => createEmptyCompany());
  const [formInitialThemeId, setFormInitialThemeId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const [themes, setThemes] = useState<Theme[]>([]);
  const [companyThemes, setCompanyThemes] = useState<Record<string, string>>({});
  const [activeThemeId, setActiveThemeId] = useState<string>(ALL_THEME_ID);
  const [newThemeName, setNewThemeName] = useState("");
  const [showNewThemeInput, setShowNewThemeInput] = useState(false);

  const [investorByTicker, setInvestorByTicker] = useState<Record<string, InvestorEntry>>({});

  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [bulkResult, setBulkResult] = useState<{ ok: number; failed: number; skipped: number } | null>(null);

  const [refreshingTicker, setRefreshingTicker] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);


  const refreshInvestor = async (ticker: string) => {
    if (!ticker || !/^\d+$/.test(ticker)) return;
    setInvestorByTicker((prev) => ({ ...prev, [ticker]: { status: "loading" } }));
    try {
      const res = await fetch(`/api/investor/${ticker}`, { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setInvestorByTicker((prev) => ({
          ...prev,
          [ticker]: { status: "error", message: body.error ?? `HTTP ${res.status}` },
        }));
        return;
      }
      const json = (await res.json()) as InvestorActivity & { fetchedAt: string };
      setInvestorByTicker((prev) => ({
        ...prev,
        [ticker]: { status: "ready", data: json, fetchedAt: json.fetchedAt },
      }));
    } catch (err) {
      setInvestorByTicker((prev) => ({
        ...prev,
        [ticker]: { status: "error", message: String(err) },
      }));
    }
  };

  useEffect(() => {
    const loaded = loadUserCompanies();
    const loadedThemes = loadThemes();
    const loadedMapping = loadCompanyThemes();
    setUserCompanies(loaded);
    setThemes(loadedThemes);
    setCompanyThemes(loadedMapping);
  }, []);


  const addTheme = (name: string): Theme | null => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    if (themes.some((t) => t.name === trimmed)) return themes.find((t) => t.name === trimmed) ?? null;
    const theme: Theme = { id: genThemeId(), name: trimmed };
    const next = [...themes, theme];
    setThemes(next);
    saveThemes(next);
    return theme;
  };

  const deleteTheme = (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("이 테마를 삭제하시겠습니까? 안에 있는 기업은 미분류로 이동합니다.")) return;
    const nextThemes = themes.filter((t) => t.id !== id);
    setThemes(nextThemes);
    saveThemes(nextThemes);
    const nextMapping = pruneMappingForThemes(companyThemes, nextThemes);
    setCompanyThemes(nextMapping);
    saveCompanyThemes(nextMapping);
    if (activeThemeId === id) setActiveThemeId(ALL_THEME_ID);
  };

  const moveCompanyToTheme = (ticker: string, themeId: string | null) => {
    const next = { ...companyThemes };
    if (themeId === null || themeId === UNCATEGORIZED_THEME_ID) {
      delete next[ticker];
    } else {
      next[ticker] = themeId;
    }
    setCompanyThemes(next);
    saveCompanyThemes(next);
  };

  const handleAddTheme = () => {
    const theme = addTheme(newThemeName);
    if (theme) {
      setNewThemeName("");
      setShowNewThemeInput(false);
      setActiveThemeId(theme.id);
    }
  };

  const selected =
    allCompanies.find((company) => company.ticker === selectedTicker) ?? allCompanies[0];

  useEffect(() => {
    if (!selected) return;
    let nextNotes: SpecialNote[] = [];
    let nextMemo = "";
    try {
      const rawNotes = window.localStorage.getItem(`dartlab:notes:${selected.ticker}`);
      nextNotes = rawNotes ? (JSON.parse(rawNotes) as SpecialNote[]) : [];
      nextMemo = window.localStorage.getItem(`dartlab:memo:${selected.ticker}`) ?? "";
    } catch {
      nextNotes = [];
      nextMemo = "";
    }
    setUserNotes(nextNotes);
    setMemo(nextMemo);
  }, [selected]);

  useEffect(() => {
    const ticker = selected?.ticker;
    if (!ticker) return;
    if (investorByTicker[ticker]) return;
    void refreshInvestor(ticker);
    // refreshInvestor mutates state but is stable across renders for the same ticker
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.ticker]);

  const addUserNote = (note: SpecialNote) => {
    const next = [...userNotes, note];
    setUserNotes(next);
    try {
      window.localStorage.setItem(`dartlab:notes:${selected.ticker}`, JSON.stringify(next));
    } catch {}
  };

  const removeUserNote = (index: number) => {
    const next = userNotes.filter((_, i) => i !== index);
    setUserNotes(next);
    try {
      window.localStorage.setItem(`dartlab:notes:${selected.ticker}`, JSON.stringify(next));
    } catch {}
  };

  const updateMemo = (value: string) => {
    setMemo(value);
    try {
      window.localStorage.setItem(`dartlab:memo:${selected.ticker}`, value);
    } catch {}
  };

  const themeCounts = useMemo(() => {
    const counts: Record<string, number> = {
      [ALL_THEME_ID]: allCompanies.length,
      [UNCATEGORIZED_THEME_ID]: 0,
    };
    for (const theme of themes) counts[theme.id] = 0;
    for (const c of allCompanies) {
      const t = companyThemes[c.ticker];
      if (t && counts[t] !== undefined) counts[t] += 1;
      else counts[UNCATEGORIZED_THEME_ID] += 1;
    }
    return counts;
  }, [allCompanies, companyThemes, themes]);

  const filteredCompanies = useMemo(() => {
    let list = allCompanies;
    if (activeThemeId === UNCATEGORIZED_THEME_ID) {
      list = list.filter((c) => !companyThemes[c.ticker]);
    } else if (activeThemeId !== ALL_THEME_ID) {
      list = list.filter((c) => companyThemes[c.ticker] === activeThemeId);
    }
    const normalized = query.trim().toLowerCase();
    if (normalized) {
      list = list.filter((company) =>
        [company.name, company.ticker, company.industry, company.market]
          .join(" ")
          .toLowerCase()
          .includes(normalized),
      );
    }
    // 등급순 정렬: A → B+ → B → C+ → C → D → 미평가
    list = [...list].sort((a, b) => {
      const rankDiff = gradeRank(a.grade) - gradeRank(b.grade);
      if (rankDiff !== 0) return rankDiff;
      // 같은 등급이면 score 높은 순, 그래도 같으면 이름순
      const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (a.name ?? "").localeCompare(b.name ?? "", "ko-KR");
    });
    return list;
  }, [allCompanies, query, activeThemeId, companyThemes]);

  const runBulkImport = async () => {
    if (bulkImporting) return;
    setBulkImporting(true);
    setBulkResult(null);
    setBulkProgress({ done: 0, total: SAMPLE_STOCKS.length, current: "" });

    let ok = 0;
    let failed = 0;
    let skipped = 0;
    let currentList = loadUserCompanies();
    let currentThemes = loadThemes();
    let currentMapping = loadCompanyThemes();
    // Bulk import은 user companies 기준으로만 중복 체크 — 빌트인 스켈레톤은 덮어쓰기 허용
    const existingTickers = new Set(currentList.map((c) => c.ticker));

    for (let i = 0; i < SAMPLE_STOCKS.length; i++) {
      const name = SAMPLE_STOCKS[i];
      setBulkProgress({ done: i, total: SAMPLE_STOCKS.length, current: name });
      try {
        const res = await fetch(`/api/dart/fetch?query=${encodeURIComponent(name)}`);
        if (!res.ok) {
          failed += 1;
          continue;
        }
        const data = (await res.json()) as {
          partial: Partial<Company>;
        };
        const partial = data.partial;
        const ticker = partial.ticker;
        if (!ticker) {
          failed += 1;
          continue;
        }
        if (existingTickers.has(ticker)) {
          skipped += 1;
          continue;
        }

        const base = createEmptyCompany();
        const company: Company = {
          ...base,
          ...partial,
          ticker,
          corpCode: partial.corpCode ?? undefined,
          valuation: { ...base.valuation, ...(partial.valuation ?? {}) },
          financials: partial.financials?.length ? partial.financials : base.financials,
          quarterly: partial.quarterly?.length ? partial.quarterly : base.quarterly,
          filings: partial.filings ?? base.filings,
          metrics: partial.metrics ?? base.metrics,
          ratios: partial.ratios ?? base.ratios,
          report: partial.report ?? base.report,
          nextQuestions: partial.nextQuestions ?? base.nextQuestions,
          investorActivity: null,
        };
        currentList = [...currentList, company];
        saveUserCompanies(currentList);
        existingTickers.add(ticker);

        const suggestion = suggestTheme(company.industry || "", company.name || "");
        if (suggestion) {
          const resolved = resolveSuggestedTheme(suggestion, currentThemes);
          let themeId = resolved.existing?.id;
          if (!themeId && resolved.toCreate) {
            const newTheme = { id: genThemeId(), name: resolved.toCreate };
            currentThemes = [...currentThemes, newTheme];
            saveThemes(currentThemes);
            themeId = newTheme.id;
          }
          if (themeId) {
            currentMapping = { ...currentMapping, [ticker]: themeId };
            saveCompanyThemes(currentMapping);
          }
        }
        ok += 1;
      } catch {
        failed += 1;
      }
    }

    setUserCompanies(currentList);
    setThemes(currentThemes);
    setCompanyThemes(currentMapping);
    setBulkProgress(null);
    setBulkImporting(false);
    setBulkResult({ ok, failed, skipped });
  };

  const refreshCompany = async (company: Company) => {
    const ticker = company.ticker;
    if (!ticker) return;
    setRefreshingTicker(ticker);
    setRefreshError(null);
    try {
      const query = ticker || company.name;
      const res = await fetch(`/api/dart/fetch?query=${encodeURIComponent(query)}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { partial: Partial<Company> };
      const p = data.partial;

      const updated: Company = {
        ...company,
        // Data fields — always overwrite with fresh
        corpCode: p.corpCode ?? company.corpCode,
        market: p.market || company.market,
        industry: p.industry || company.industry,
        updatedAt: p.updatedAt || company.updatedAt,
        valuation: {
          ...company.valuation,
          per: p.valuation?.per ?? null,
          pbr: p.valuation?.pbr ?? null,
          roe: p.valuation?.roe ?? null,
          debtRatio: p.valuation?.debtRatio ?? null,
          asOf: p.valuation?.asOf || company.valuation.asOf,
        },
        financials: p.financials?.length ? p.financials : company.financials,
        quarterly: p.quarterly?.length ? p.quarterly : company.quarterly,
        filings: p.filings?.length ? p.filings : company.filings,
        // Auto-derived — overwrite (user can edit later via form)
        headline: p.headline || company.headline,
        oneLine: p.oneLine || company.oneLine,
        grade: p.grade ?? company.grade,
        gradeLabel: p.gradeLabel ?? company.gradeLabel,
        score: p.score ?? company.score,
        metrics: p.metrics?.length ? p.metrics : company.metrics,
        ratios: p.ratios?.length ? p.ratios : company.ratios,
        report: p.report?.length ? p.report : company.report,
        nextQuestions: p.nextQuestions?.length ? p.nextQuestions : company.nextQuestions,
        // Don't touch user-only fields: name (user-set), specialNotes/schedule/external/business/risks
      };

      const next = upsertUserCompany(updated);
      setUserCompanies(next);
      void refreshInvestor(ticker);
    } catch (err) {
      setRefreshError(String(err instanceof Error ? err.message : err));
    } finally {
      setRefreshingTicker(null);
    }
  };

  const openAddForm = () => {
    setFormMode("add");
    setFormInitial(createEmptyCompany());
    setFormInitialThemeId(
      activeThemeId !== ALL_THEME_ID && activeThemeId !== UNCATEGORIZED_THEME_ID
        ? activeThemeId
        : null,
    );
    setFormKey((k) => k + 1);
    setFormOpen(true);
  };

  const openEditForm = (company: Company) => {
    setFormMode("edit");
    setFormInitial(company);
    setFormInitialThemeId(companyThemes[company.ticker] ?? null);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  };

  const handleFormSave = (company: Company, themeId: string | null) => {
    const next = upsertUserCompany(company);
    setUserCompanies(next);
    moveCompanyToTheme(company.ticker, themeId);
    setSelectedTicker(company.ticker);
    setFormOpen(false);
  };

  const handleDelete = (ticker: string) => {
    if (typeof window !== "undefined" && !window.confirm("이 기업을 삭제하시겠습니까?")) return;
    const next = deleteUserCompany(ticker);
    setUserCompanies(next);
    if (selectedTicker === ticker) {
      const fallback = builtIn[0]?.ticker ?? next[0]?.ticker ?? "";
      setSelectedTicker(fallback);
    }
  };

  const annualRevenues = selected.financials
    .map((row) => row.revenue)
    .filter((v): v is number => v !== null);
  const maxRevenue = annualRevenues.length ? Math.max(...annualRevenues) : 1;
  const annualOpAbs = selected.financials
    .map((row) => row.operatingProfit)
    .filter((v): v is number => v !== null)
    .map(Math.abs);
  const maxOperatingProfit = annualOpAbs.length ? Math.max(1, ...annualOpAbs) : 1;

  return (
    <main className="min-h-screen bg-[#f5f8f7] text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-zinc-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">DartLab 가족용 기업 분석</p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
              DART · Yahoo · Naver를 한 화면에
            </h1>
          </div>

          <div className="flex flex-wrap gap-2 text-sm text-zinc-700">
            <span className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
              <Database className="h-4 w-4 text-emerald-700" />
              DART OpenAPI 연결됨
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-cyan-900">
              <RefreshCw className="h-4 w-4 text-cyan-700" />
              주가·수급 자동 갱신
            </span>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <aside className="min-w-0 space-y-4">
            <section className="rounded-lg border border-zinc-200 bg-white p-4">
              <label className="text-sm font-semibold text-zinc-900" htmlFor="company-search">
                기업 검색
              </label>
              <div className="mt-3 flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                <Search className="h-4 w-4 text-zinc-500" />
                <input
                  id="company-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="회사명, 종목코드, 업종"
                  className="min-w-0 w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
                />
              </div>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-zinc-900">테마</div>
                <button
                  type="button"
                  onClick={() => setShowNewThemeInput((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
                >
                  <Plus className="h-3 w-3" />새 테마
                </button>
              </div>
              {showNewThemeInput ? (
                <form
                  className="mt-2 flex gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddTheme();
                  }}
                >
                  <input
                    autoFocus
                    value={newThemeName}
                    onChange={(e) => setNewThemeName(e.target.value)}
                    placeholder="이차전지, 자동차 등"
                    className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    추가
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewThemeInput(false);
                      setNewThemeName("");
                    }}
                    className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
                  >
                    취소
                  </button>
                </form>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <ThemePill
                  label="전체"
                  count={themeCounts[ALL_THEME_ID] ?? 0}
                  active={activeThemeId === ALL_THEME_ID}
                  onClick={() => setActiveThemeId(ALL_THEME_ID)}
                />
                {themes.map((t) => (
                  <ThemePill
                    key={t.id}
                    label={t.name}
                    count={themeCounts[t.id] ?? 0}
                    active={activeThemeId === t.id}
                    onClick={() => setActiveThemeId(t.id)}
                    onDelete={() => deleteTheme(t.id)}
                  />
                ))}
                <ThemePill
                  label="미분류"
                  count={themeCounts[UNCATEGORIZED_THEME_ID] ?? 0}
                  active={activeThemeId === UNCATEGORIZED_THEME_ID}
                  onClick={() => setActiveThemeId(UNCATEGORIZED_THEME_ID)}
                  muted
                />
              </div>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-2">
              <div className="flex items-center justify-between px-2 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-zinc-900">관심 기업</span>
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600">
                    등급순
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={runBulkImport}
                    disabled={bulkImporting}
                    title={`사진의 샘플 ${SAMPLE_STOCKS.length}개 종목 일괄 가져오기`}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-2 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {bulkImporting
                      ? `${bulkProgress?.done ?? 0}/${bulkProgress?.total ?? SAMPLE_STOCKS.length}`
                      : "샘플"}
                  </button>
                  <button
                    type="button"
                    onClick={openAddForm}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    기업 추가
                  </button>
                </div>
              </div>
              {bulkProgress ? (
                <div className="mx-2 mb-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
                  가져오는 중: {bulkProgress.current} ({bulkProgress.done}/{bulkProgress.total})
                </div>
              ) : null}
              {bulkResult && !bulkImporting ? (
                <div className="mx-2 mb-2 flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs text-zinc-700">
                  <span>
                    완료: 추가 {bulkResult.ok}개 · 중복 {bulkResult.skipped} · 실패 {bulkResult.failed}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBulkResult(null)}
                    className="rounded p-0.5 text-zinc-500 hover:bg-zinc-200"
                    aria-label="닫기"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : null}
              <div className="space-y-2">
                {filteredCompanies.map((company) => {
                  const isActive = company.ticker === selected.ticker;
                  const isUser = userTickers.has(company.ticker);

                  return (
                    <div
                      key={company.ticker}
                      className={`min-w-0 rounded-md border transition ${
                        isActive
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-transparent bg-white hover:border-zinc-200 hover:bg-zinc-50"
                      }`}
                    >
                      <button
                        className="flex min-w-0 w-full items-center justify-between gap-2 px-2.5 py-2 text-left"
                        onClick={() => {
                          setSelectedTicker(company.ticker);
                          setActiveTab("summary");
                        }}
                        type="button"
                        title={`${company.ticker} · ${company.market}${company.headline ? ` — ${company.headline}` : ""}`}
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                          <span className="truncate text-sm font-semibold">
                            {company.name || "(이름 없음)"}
                          </span>
                          {isUser ? (
                            <span className="shrink-0 rounded bg-cyan-100 px-1 py-0 text-[9px] font-semibold text-cyan-900">
                              U
                            </span>
                          ) : null}
                        </div>
                        <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          {company.grade}
                        </span>
                      </button>
                      {isActive ? (
                        <div className="flex items-center gap-1 border-t border-zinc-100 bg-zinc-50/70 px-2 py-1">
                          <select
                            value={companyThemes[company.ticker] ?? UNCATEGORIZED_THEME_ID}
                            onChange={(e) =>
                              moveCompanyToTheme(
                                company.ticker,
                                e.target.value === UNCATEGORIZED_THEME_ID ? null : e.target.value,
                              )
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-[11px] outline-none focus:border-emerald-500"
                            aria-label={`${company.name} 테마`}
                          >
                            <option value={UNCATEGORIZED_THEME_ID}>미분류</option>
                            {themes.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                          {isUser ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditForm(company)}
                                className="inline-flex items-center rounded-md px-1 py-0.5 text-zinc-700 hover:bg-zinc-200"
                                aria-label="수정"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(company.ticker)}
                                className="inline-flex items-center rounded-md px-1 py-0.5 text-rose-700 hover:bg-rose-100"
                                aria-label="삭제"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {filteredCompanies.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-zinc-500">
                    검색 결과가 없습니다.
                  </p>
                ) : null}
              </div>
            </section>

            <section className="rounded-lg border border-cyan-200 bg-cyan-50 p-4">
              <div className="flex items-center gap-2 font-semibold text-cyan-950">
                <Sparkles className="h-4 w-4" />
                아버지용 읽기 순서
              </div>
              <ol className="mt-3 space-y-2 text-sm text-cyan-950">
                <li>1. 한 줄 요약과 가치지표(PER·PBR·ROE)를 봅니다.</li>
                <li>2. 매출·영업이익률과 분기 추세를 확인합니다.</li>
                <li>3. 특이사항(라이센스·지분·계약)을 살펴봅니다.</li>
                <li>4. 일정과 외부 자료로 보완합니다.</li>
                <li>5. 메모에 본인 의견을 적어둡니다.</li>
              </ol>
            </section>
          </aside>

          <section className="min-w-0 space-y-5">
            <CompanyNameBlock
              company={selected}
              refreshing={refreshingTicker === selected.ticker}
              refreshError={refreshError}
              onRefresh={() => refreshCompany(selected)}
              onDismissError={() => setRefreshError(null)}
            />

            <TradingViewMiniChart key={selected.ticker} ticker={selected.ticker} />

            <CompanyStatusCards company={selected} />

            <nav className="flex gap-2 overflow-x-auto rounded-lg border border-zinc-200 bg-white p-2">
              {tabs.map((tab) => (
                <button
                  className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold transition ${
                    activeTab === tab.id
                      ? "bg-zinc-950 text-white"
                      : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {activeTab === "summary" ? (
              <SummaryPanel
                company={selected}
                investorEntry={investorByTicker[selected.ticker]}
                onRefreshInvestor={() => refreshInvestor(selected.ticker)}
              />
            ) : activeTab === "finance" ? (
              <FinancePanel
                company={selected}
                maxOperatingProfit={maxOperatingProfit}
                maxRevenue={maxRevenue}
                userNotes={userNotes}
                onAddNote={addUserNote}
                onRemoveNote={removeUserNote}
              />
            ) : activeTab === "business" ? (
              <BusinessPanel company={selected} />
            ) : activeTab === "risk" ? (
              <RiskPanel company={selected} />
            ) : (
              <ReportPanel company={selected} memo={memo} onMemoChange={updateMemo} />
            )}
          </section>
        </div>
      </div>

      <CompanyForm
        key={formKey}
        open={formOpen}
        mode={formMode}
        initial={formInitial}
        initialThemeId={formInitialThemeId}
        themes={themes}
        onAddTheme={(name) => addTheme(name)}
        existingTickers={new Set(allCompanies.map((c) => c.ticker))}
        onClose={() => setFormOpen(false)}
        onSave={handleFormSave}
      />
    </main>
  );
}

function CompanyNameBlock({
  company,
  refreshing,
  refreshError,
  onRefresh,
  onDismissError,
}: {
  company: Company;
  refreshing: boolean;
  refreshError: string | null;
  onRefresh: () => void;
  onDismissError: () => void;
}) {
  const hasDescription = !!company.headline || !!company.oneLine;
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-zinc-700">
          {company.ticker}
        </span>
        <span className="rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-800">
          {company.market}
        </span>
        {company.industry ? (
          <span className="rounded-md bg-cyan-50 px-2 py-1 font-medium text-cyan-800">
            {company.industry}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          title={`${company.name} 데이터를 DART + Yahoo + Naver에서 다시 가져옵니다`}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-60"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "갱신 중" : "데이터 갱신"}
        </button>
      </div>

      <h2 className="mt-3 text-3xl font-semibold">{company.name}</h2>
      {hasDescription ? (
        <>
          {company.headline ? (
            <p className="mt-2 text-lg font-medium text-zinc-800">{company.headline}</p>
          ) : null}
          {company.oneLine ? (
            <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-700">{company.oneLine}</p>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">
          상단 우측 <span className="font-semibold text-emerald-700">데이터 갱신</span> 버튼을 누르면
          DART · Yahoo · Naver에서 최신 정보를 불러와 한 줄 요약과 지표가 채워집니다.
        </p>
      )}
      {refreshError ? (
        <div className="mt-3 flex items-start justify-between gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          <span>갱신 실패: {refreshError}</span>
          <button
            type="button"
            onClick={onDismissError}
            className="rounded p-0.5 text-rose-700 hover:bg-rose-100"
            aria-label="닫기"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : null}
    </section>
  );
}

function CompanyStatusCards({ company }: { company: Company }) {
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-emerald-900">{company.gradeLabel}</span>
          <ShieldCheck className="h-5 w-5 text-emerald-700" />
        </div>
        <div className="mt-2 text-3xl font-semibold text-emerald-950">{company.grade}</div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-zinc-700">종합 점수</span>
          <CircleGauge className="h-5 w-5 text-cyan-700" />
        </div>
        <div className="mt-2 text-3xl font-semibold">{company.score}</div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold text-zinc-700">데이터 기준</div>
        <div className="mt-2 text-sm text-zinc-600">
          {company.updatedAt || <span className="text-zinc-400">갱신 필요</span>}
        </div>
      </div>
    </section>
  );
}

function SummaryPanel({
  company,
  investorEntry,
  onRefreshInvestor,
}: {
  company: Company;
  investorEntry: InvestorEntry | undefined;
  onRefreshInvestor: () => void;
}) {
  return (
    <div className="space-y-5">
      {company.metrics.length > 0 ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {company.metrics.map((metric) => (
            <article
              className={`rounded-lg border p-4 ${toneClass[metric.tone]}`}
              key={metric.label}
            >
              <div className="text-sm font-semibold opacity-80">{metric.label}</div>
              <div className="mt-3 text-2xl font-semibold">{metric.value}</div>
              <p className="mt-2 text-sm opacity-80">{metric.change}</p>
            </article>
          ))}
        </section>
      ) : (
        <EmptyHint message="요약 메트릭이 비어 있습니다. 수정에서 메트릭을 추가하면 카드가 표시됩니다." />
      )}

      <ValuationCard company={company} />

      <InvestorFlowCard
        company={company}
        entry={investorEntry}
        onRefresh={onRefreshInvestor}
      />

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">최근 4년 실적 흐름</h3>
              <p className="mt-1 text-sm text-zinc-600">매출과 영업이익률을 같이 봅니다.</p>
            </div>
            <LineChart className="h-5 w-5 text-emerald-700" />
          </div>
          <div className="mt-5 space-y-4">
            {company.financials.map((row) => {
              const annualRevenues = company.financials
                .map((item) => item.revenue)
                .filter((v): v is number => v !== null);
              const maxRev = annualRevenues.length ? Math.max(...annualRevenues) : 1;
              const revenueWidth =
                row.revenue === null
                  ? "8%"
                  : `${Math.max(8, (row.revenue / maxRev) * 100)}%`;

              return (
                <div className="grid gap-3 sm:grid-cols-[70px_1fr_86px]" key={row.period}>
                  <div className="font-mono text-sm font-semibold text-zinc-700">{row.period}</div>
                  <div className="h-8 overflow-hidden rounded-md bg-zinc-100">
                    <div
                      className={`flex h-full items-center rounded-md px-3 text-sm font-semibold text-white ${
                        row.revenue === null ? "bg-zinc-400" : "bg-emerald-500"
                      }`}
                      style={{ width: revenueWidth }}
                    >
                      {formatTrillion(row.revenue)}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-zinc-800">{formatPercent(row.margin)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-cyan-700" />
            <h3 className="text-lg font-semibold">체크 포인트</h3>
          </div>
          <div className="mt-4 space-y-4">
            {company.ratios.map((ratio) => (
              <div key={ratio.label}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{ratio.label}</p>
                    <p className="text-sm text-zinc-600">{ratio.helper}</p>
                  </div>
                  <span className="rounded-md bg-zinc-100 px-2 py-1 text-sm font-semibold">
                    {ratio.value}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-zinc-100">
                  <div
                    className={`h-2 rounded-full ${progressClass[ratio.tone]}`}
                    style={{ width: `${ratio.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function formatShares(value: Maybe<number>): string {
  if (value === null) return "NA";
  const abs = Math.abs(value);
  let formatted: string;
  if (abs >= 1_000_000) {
    formatted = `${(value / 1_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}M`;
  } else if (abs >= 1_000) {
    formatted = `${(value / 1_000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}K`;
  } else {
    formatted = value.toLocaleString("ko-KR");
  }
  return `${value > 0 ? "+" : ""}${formatted}주`;
}

function InvestorFlowCard({
  company,
  entry,
  onRefresh,
}: {
  company: Company;
  entry: InvestorEntry | undefined;
  onRefresh: () => void;
}) {
  // Live entry wins; fall back to stored investorActivity for offline/cached scenarios
  const activity =
    entry?.status === "ready" ? entry.data : company.investorActivity ?? null;
  const isLoading = entry?.status === "loading";
  const errorMessage = entry?.status === "error" ? entry.message : null;
  const fetchedAt = entry?.status === "ready" ? entry.fetchedAt : null;

  if (!activity || !activity.latest) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-zinc-700">
            <BarChart3 className="h-5 w-5 text-zinc-500" />
            <h3 className="text-lg font-semibold">수급 (외국인 · 기관)</h3>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "불러오는 중" : "다시 조회"}
          </button>
        </div>
        <p className="mt-3 text-sm text-zinc-500">
          {isLoading
            ? "Naver 증권에서 수급 데이터를 불러오는 중입니다..."
            : errorMessage
              ? `수급 조회 실패: ${errorMessage}`
              : "수급 데이터를 불러올 수 없습니다. '다시 조회' 버튼을 눌러주세요."}
        </p>
      </section>
    );
  }

  const { latest, sum5d, sum20d, rows, note } = activity;
  const rowsForChart = rows.slice(0, 10);
  const chartMax = Math.max(
    1,
    ...rowsForChart.flatMap((r) => [
      r.foreignerNet !== null ? Math.abs(r.foreignerNet) : 0,
      r.institutionNet !== null ? Math.abs(r.institutionNet) : 0,
    ]),
  );

  const toneText = (v: Maybe<number>) =>
    v === null ? "text-zinc-500" : v > 0 ? "text-emerald-700" : v < 0 ? "text-rose-700" : "text-zinc-700";

  return (
    <section className="rounded-lg border border-sky-200 bg-sky-50 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sky-950">
          <BarChart3 className="h-5 w-5" />
          <h3 className="text-lg font-semibold">수급 (외국인 · 기관)</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-sky-900">최근 거래일 {latest.date}</span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1 rounded-md border border-sky-300 bg-white px-2 py-1 text-xs font-semibold text-sky-900 hover:bg-sky-100 disabled:opacity-50"
            title={fetchedAt ? `최종 조회: ${new Date(fetchedAt).toLocaleString("ko-KR")}` : "다시 조회"}
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "조회중" : "다시 조회"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SummaryBlock
          title="외국인 순매수"
          latest={latest.foreignerNet}
          sum5d={sum5d.foreigner}
          sum20d={sum20d.foreigner}
          footer={
            latest.foreignerHoldingPct !== null
              ? `외국인 보유율 ${latest.foreignerHoldingPct.toFixed(2)}%`
              : undefined
          }
        />
        <SummaryBlock
          title="기관 순매수 (연기금 포함)"
          latest={latest.institutionNet}
          sum5d={sum5d.institution}
          sum20d={sum20d.institution}
        />
      </div>

      <div className="mt-4 rounded-lg border border-sky-200 bg-white p-3">
        <div className="grid grid-cols-[72px_minmax(0,1fr)_72px_minmax(0,1fr)_72px] items-center gap-x-2 border-b border-zinc-100 pb-1.5 text-[11px] font-semibold text-zinc-500">
          <span>날짜</span>
          <span className="text-center">외국인</span>
          <span className="text-right">금액</span>
          <span className="text-center">기관</span>
          <span className="text-right">금액</span>
        </div>
        <div className="mt-2 space-y-1.5">
          {rowsForChart.map((row) => (
            <div
              key={row.date}
              className="grid grid-cols-[72px_minmax(0,1fr)_72px_minmax(0,1fr)_72px] items-center gap-x-2 text-[11px]"
            >
              <span className="font-mono text-zinc-700">{row.date.slice(5)}</span>
              <FlowBar value={row.foreignerNet} max={chartMax} />
              <span
                className={`text-right font-mono font-semibold ${toneText(row.foreignerNet)}`}
              >
                {formatShares(row.foreignerNet)}
              </span>
              <FlowBar value={row.institutionNet} max={chartMax} />
              <span
                className={`text-right font-mono font-semibold ${toneText(row.institutionNet)}`}
              >
                {formatShares(row.institutionNet)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-sky-800">ⓘ {note}</p>
    </section>
  );
}

function SummaryBlock({
  title,
  latest,
  sum5d,
  sum20d,
  footer,
}: {
  title: string;
  latest: Maybe<number>;
  sum5d: Maybe<number>;
  sum20d: Maybe<number>;
  footer?: string;
}) {
  const tone = (v: Maybe<number>) =>
    v === null ? "text-zinc-500" : v > 0 ? "text-emerald-700" : v < 0 ? "text-rose-700" : "text-zinc-700";
  return (
    <div className="rounded-lg border border-sky-200 bg-white p-4">
      <div className="text-sm font-semibold text-sky-900">{title}</div>
      <div className={`mt-2 text-2xl font-semibold ${tone(latest)}`}>{formatShares(latest)}</div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-zinc-500">최근 5거래일</div>
          <div className={`font-semibold ${tone(sum5d)}`}>{formatShares(sum5d)}</div>
        </div>
        <div>
          <div className="text-zinc-500">최근 20거래일</div>
          <div className={`font-semibold ${tone(sum20d)}`}>{formatShares(sum20d)}</div>
        </div>
      </div>
      {footer ? (
        <div className="mt-3 text-xs text-zinc-600">{footer}</div>
      ) : null}
    </div>
  );
}

function FlowBar({ value, max }: { value: Maybe<number>; max: number }) {
  if (value === null) {
    return (
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div className="absolute left-1/2 top-0 h-2 w-px bg-zinc-300" />
      </div>
    );
  }
  // Cap at 50% — bar grows from center toward one edge, never past the container
  const pct = Math.min(50, (Math.abs(value) / max) * 50);
  const isNeg = value < 0;
  const color = value > 0 ? "bg-emerald-500" : value < 0 ? "bg-rose-500" : "bg-zinc-300";
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-100">
      <div className="absolute left-1/2 top-0 h-2 w-px bg-zinc-300" />
      <div
        className={`absolute top-0 h-2 ${color} ${isNeg ? "rounded-l-full" : "rounded-r-full"}`}
        style={{
          width: `${pct}%`,
          left: isNeg ? `${50 - pct}%` : "50%",
        }}
      />
    </div>
  );
}

function ValuationCard({ company }: { company: Company }) {
  const items: { label: string; value: string; helper: string }[] = [
    {
      label: "PER",
      value: formatRatio(company.valuation.per),
      helper: "이익 대비 주가 — 낮을수록 저평가 신호",
    },
    {
      label: "PBR",
      value: formatRatio(company.valuation.pbr),
      helper: "자본 대비 주가 — 1배 미만이면 청산가치 이하",
    },
    {
      label: "ROE",
      value: formatPercent(company.valuation.roe),
      helper: "자기자본 수익률 — 높을수록 효율적",
    },
    {
      label: "부채비율",
      value: formatPercent(company.valuation.debtRatio),
      helper: "200% 이하가 보통, 100% 이하면 안전권",
    },
  ];

  return (
    <section className="rounded-lg border border-violet-200 bg-violet-50 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-violet-950">
          <Percent className="h-5 w-5" />
          <h3 className="text-lg font-semibold">가치지표 (PER · PBR · ROE · 부채비율)</h3>
        </div>
        <span className="text-xs font-mono text-violet-900">기준 {company.valuation.asOf}</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div className="rounded-lg border border-violet-200 bg-white p-4" key={item.label}>
            <div className="text-sm font-semibold text-violet-900">{item.label}</div>
            <div className="mt-2 text-2xl font-semibold text-zinc-950">{item.value}</div>
            <p className="mt-2 text-xs leading-5 text-zinc-600">{item.helper}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinancePanel({
  company,
  maxOperatingProfit,
  maxRevenue,
  userNotes,
  onAddNote,
  onRemoveNote,
}: {
  company: Company;
  maxOperatingProfit: number;
  maxRevenue: number;
  userNotes: SpecialNote[];
  onAddNote: (note: SpecialNote) => void;
  onRemoveNote: (index: number) => void;
}) {
  return (
    <div className="space-y-5">
      <AnnualFinanceTable
        company={company}
        maxOperatingProfit={maxOperatingProfit}
        maxRevenue={maxRevenue}
      />
      <QuarterlyFinanceTable company={company} />
      <SpecialNotesSection
        company={company}
        userNotes={userNotes}
        onAddNote={onAddNote}
        onRemoveNote={onRemoveNote}
      />
    </div>
  );
}

function AnnualFinanceTable({
  company,
  maxOperatingProfit,
  maxRevenue,
}: {
  company: Company;
  maxOperatingProfit: number;
  maxRevenue: number;
}) {
  const rows = company.financials;
  return (
    <section className="rounded-lg border border-zinc-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-zinc-200 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold">연간 재무제표</h3>
          <p className="mt-1 text-sm text-zinc-600">
            전년 대비 증감(YoY)을 함께 보여줍니다. 비공시는 NA로 표시합니다.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-900">
          <BarChart3 className="h-4 w-4" />
          단위: 억원
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-sm text-zinc-600">
              <th className="px-5 py-3 font-semibold">연도</th>
              <th className="px-5 py-3 font-semibold">매출</th>
              <th className="px-5 py-3 font-semibold">영업이익</th>
              <th className="px-5 py-3 font-semibold">순이익</th>
              <th className="px-5 py-3 font-semibold">영업이익률</th>
              <th className="px-5 py-3 font-semibold">매출 YoY</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const prev = idx > 0 ? rows[idx - 1] : null;
              const yoy = prev ? computeYoY(row.revenue, prev.revenue) : null;
              return (
                <tr className="border-b border-zinc-100" key={row.period}>
                  <td className="px-5 py-4 font-mono font-semibold">{row.period}</td>
                  <td className="px-5 py-4">
                    <MetricBar value={row.revenue} max={maxRevenue} label={formatTrillion(row.revenue)} />
                  </td>
                  <td className="px-5 py-4">
                    <MetricBar
                      value={row.operatingProfit === null ? null : Math.abs(row.operatingProfit)}
                      max={maxOperatingProfit}
                      label={formatTrillion(row.operatingProfit)}
                      negative={(row.operatingProfit ?? 0) < 0}
                    />
                  </td>
                  <td className="px-5 py-4 font-semibold">{formatTrillion(row.netIncome)}</td>
                  <td className="px-5 py-4 font-semibold">{formatPercent(row.margin)}</td>
                  <td className="px-5 py-4">
                    <YoYBadge value={yoy} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function QuarterlyFinanceTable({ company }: { company: Company }) {
  const rows = company.quarterly;
  return (
    <section className="rounded-lg border border-zinc-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-zinc-200 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold">분기 재무제표 (최근 5개 분기)</h3>
          <p className="mt-1 text-sm text-zinc-600">
            2026년 1분기까지 포함. 미공시는 NA로 표시합니다.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
          <BarChart3 className="h-4 w-4" />
          단위: 억원
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-sm text-zinc-600">
              <th className="px-5 py-3 font-semibold">분기</th>
              <th className="px-5 py-3 font-semibold">매출</th>
              <th className="px-5 py-3 font-semibold">영업이익</th>
              <th className="px-5 py-3 font-semibold">순이익</th>
              <th className="px-5 py-3 font-semibold">영업이익률</th>
              <th className="px-5 py-3 font-semibold">매출 QoQ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const prev = idx > 0 ? rows[idx - 1] : null;
              const qoq = prev ? computeYoY(row.revenue, prev.revenue) : null;
              return (
                <tr className="border-b border-zinc-100" key={row.period}>
                  <td className="px-5 py-4 font-mono font-semibold">{row.period}</td>
                  <td className="px-5 py-4 font-semibold">{formatTrillion(row.revenue)}</td>
                  <td className="px-5 py-4 font-semibold">{formatTrillion(row.operatingProfit)}</td>
                  <td className="px-5 py-4 font-semibold">{formatTrillion(row.netIncome)}</td>
                  <td className="px-5 py-4 font-semibold">{formatPercent(row.margin)}</td>
                  <td className="px-5 py-4">
                    <YoYBadge value={qoq} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function YoYBadge({ value }: { value: Maybe<number> }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">
        <Minus className="h-3 w-3" /> NA
      </span>
    );
  }
  const positive = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${
        positive ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900"
      }`}
    >
      {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {`${positive ? "+" : ""}${value.toFixed(1)}%`}
    </span>
  );
}

function MetricBar({
  value,
  max,
  label,
  negative = false,
}: {
  value: Maybe<number>;
  max: number;
  label: string;
  negative?: boolean;
}) {
  if (value === null) {
    return (
      <div className="flex min-w-52 items-center gap-3">
        <div className="h-3 flex-1 rounded-full bg-zinc-100">
          <div className="h-3 w-2 rounded-full bg-zinc-300" />
        </div>
        <span className="w-20 text-sm font-semibold text-zinc-500">NA</span>
      </div>
    );
  }
  return (
    <div className="flex min-w-52 items-center gap-3">
      <div className="h-3 flex-1 rounded-full bg-zinc-100">
        <div
          className={`h-3 rounded-full ${negative ? "bg-rose-500" : "bg-emerald-500"}`}
          style={{ width: `${Math.max(6, (value / max) * 100)}%` }}
        />
      </div>
      <span className={`w-20 text-sm font-semibold ${negative ? "text-rose-700" : "text-zinc-800"}`}>
        {label}
      </span>
    </div>
  );
}

function SpecialNotesSection({
  company,
  userNotes,
  onAddNote,
  onRemoveNote,
}: {
  company: Company;
  userNotes: SpecialNote[];
  onAddNote: (note: SpecialNote) => void;
  onRemoveNote: (index: number) => void;
}) {
  const [date, setDate] = useState("");
  const [category, setCategory] = useState<SpecialNote["category"]>("기타");
  const [body, setBody] = useState("");

  const submit = () => {
    if (!body.trim()) return;
    onAddNote({
      date: date.trim() || "기록 안 함",
      category,
      body: body.trim(),
    });
    setDate("");
    setBody("");
    setCategory("기타");
  };

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <NotebookPen className="h-5 w-5 text-emerald-700" />
        <h3 className="text-xl font-semibold">특이사항 (라이센스 · 지분 · 계약)</h3>
      </div>
      <p className="mt-1 text-sm text-zinc-600">
        공시 기반 항목과 직접 추가한 메모를 함께 봅니다. 추가한 메모는 이 브라우저에만 저장됩니다.
      </p>

      <ul className="mt-5 space-y-3">
        {company.specialNotes.map((note) => (
          <li
            className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
            key={`builtin-${note.date}-${note.body.slice(0, 12)}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-md px-2 py-1 text-xs font-semibold ${
                  categoryClass[note.category] ?? "bg-zinc-100 text-zinc-800"
                }`}
              >
                {note.category}
              </span>
              <span className="font-mono text-sm text-zinc-700">{note.date}</span>
              <span className="ml-auto text-xs text-zinc-500">DartLab 기록</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-800">{note.body}</p>
          </li>
        ))}

        {userNotes.map((note, idx) => (
          <li
            className="rounded-lg border border-cyan-200 bg-cyan-50 p-4"
            key={`user-${idx}-${note.body.slice(0, 12)}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-md px-2 py-1 text-xs font-semibold ${
                  categoryClass[note.category] ?? "bg-zinc-100 text-zinc-800"
                }`}
              >
                {note.category}
              </span>
              <span className="font-mono text-sm text-cyan-900">{note.date}</span>
              <span className="ml-auto text-xs font-semibold text-cyan-800">직접 추가</span>
              <button
                type="button"
                onClick={() => onRemoveNote(idx)}
                className="inline-flex items-center gap-1 rounded-md border border-cyan-300 bg-white px-2 py-1 text-xs font-semibold text-cyan-900 hover:bg-cyan-100"
              >
                <Trash2 className="h-3 w-3" />
                삭제
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-cyan-950">{note.body}</p>
          </li>
        ))}
      </ul>

      <div className="mt-5 rounded-lg border border-dashed border-emerald-300 bg-emerald-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
          <Plus className="h-4 w-4" />
          특이사항 직접 추가
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[140px_140px_1fr_auto]">
          <input
            type="text"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder="2026.05.24"
            className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as SpecialNote["category"])}
            className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
          >
            {NOTE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="예: 자회사 지분 추가 취득"
            className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={submit}
            className="inline-flex items-center justify-center gap-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            추가
          </button>
        </div>
      </div>
    </section>
  );
}

function BusinessPanel({ company }: { company: Company }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 lg:grid-cols-3">
        {company.business.map((block) => (
          <article className="rounded-lg border border-zinc-200 bg-white p-5" key={block.title}>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-emerald-700" />
              <h3 className="text-lg font-semibold">{block.title}</h3>
            </div>
            <p className="mt-4 leading-7 text-zinc-700">{block.body}</p>
            <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
              <span className="font-semibold text-zinc-950">근거: </span>
              {block.evidence}
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-cyan-200 bg-cyan-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-cyan-800" />
            <h3 className="text-lg font-semibold text-cyan-950">최근 공시 (DART)</h3>
          </div>
          <a
            href={dartCompanyUrl(company)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-cyan-300 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-900 hover:bg-cyan-100"
          >
            <FileText className="h-3 w-3" />
            DART 바로가기 ({company.name})
          </a>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {company.filings.map((filing) => (
            <div
              className="rounded-md border border-cyan-200 bg-white p-4"
              key={`${filing.title}-${filing.date}`}
            >
              <div className="text-sm font-semibold text-cyan-800">{filing.type}</div>
              <div className="mt-2 font-semibold">
                {filing.url ? (
                  <a
                    href={filing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-900 underline-offset-2 hover:underline"
                  >
                    {filing.title}
                  </a>
                ) : (
                  filing.title
                )}
              </div>
              <div className="mt-1 font-mono text-sm text-zinc-600">{filing.date}</div>
              <p className="mt-3 text-sm text-zinc-700">{filing.note}</p>
              {filing.url ? (
                <a
                  href={filing.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-900"
                >
                  DART 원문 보기 →
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <ScheduleSection company={company} />
      <ExternalSection company={company} />
    </div>
  );
}

function ScheduleSection({ company }: { company: Company }) {
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-center gap-2 text-amber-950">
        <CalendarDays className="h-5 w-5" />
        <h3 className="text-lg font-semibold">실적 · IR 일정</h3>
      </div>
      <p className="mt-1 text-sm text-amber-900">
        반기 보고서, 분기 실적, 컨퍼런스콜 일정을 한 곳에서 확인합니다.
      </p>
      <ol className="mt-4 space-y-3">
        {company.schedule.map((item) => (
          <li
            className="flex flex-col gap-2 rounded-md border border-amber-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            key={`${item.date}-${item.event}`}
          >
            <div className="flex items-center gap-3">
              <span className="rounded-md bg-amber-100 px-2 py-1 font-mono text-sm font-semibold text-amber-900">
                {item.date}
              </span>
              <span className="font-semibold text-zinc-900">{item.event}</span>
            </div>
            <p className="text-sm text-zinc-700">{item.note}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ExternalSection({ company }: { company: Company }) {
  return (
    <section className="rounded-lg border border-indigo-200 bg-indigo-50 p-5">
      <div className="flex items-center gap-2 text-indigo-950">
        <Globe2 className="h-5 w-5" />
        <h3 className="text-lg font-semibold">외부 정보 (제품 리뷰 · 시장 전망 · 사용기)</h3>
      </div>
      <p className="mt-1 text-sm text-indigo-900">
        재무 자료만으로 안 보이는 부분을 다른 사이트에 가지 않고 여기서 같이 봅니다.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {company.external.map((item) => (
          <article
            className="rounded-lg border border-indigo-200 bg-white p-4"
            key={`${item.category}-${item.title}`}
          >
            <span
              className={`inline-block rounded-md px-2 py-1 text-xs font-semibold ${
                categoryClass[item.category] ?? "bg-zinc-100 text-zinc-800"
              }`}
            >
              {item.category}
            </span>
            <h4 className="mt-3 font-semibold leading-6 text-zinc-900">{item.title}</h4>
            <p className="mt-2 text-sm leading-6 text-zinc-700">{item.summary}</p>
            <p className="mt-3 text-xs font-medium text-indigo-700">출처: {item.source}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function RiskPanel({ company }: { company: Company }) {
  return (
    <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-lg border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <TriangleAlert className="h-5 w-5 text-amber-600" />
          <h3 className="text-xl font-semibold">먼저 볼 위험</h3>
        </div>
        <p className="mt-2 text-sm text-zinc-600">
          투자 결정을 대신하지 않습니다. 원문 공시와 증권사 리포트로 다시 확인해야 합니다.
        </p>

        <div className="mt-5 space-y-3">
          {company.risks.map((risk) => (
            <article className={`rounded-lg border p-4 ${riskClass[risk.level]}`} key={risk.title}>
              <div className="flex items-start justify-between gap-3">
                <h4 className="font-semibold">{risk.title}</h4>
                <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold">
                  {risk.level}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6">{risk.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-700" />
          <h3 className="text-xl font-semibold">확인 질문</h3>
        </div>
        <div className="mt-5 space-y-3">
          {company.nextQuestions.map((question) => (
            <div
              className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 p-4"
              key={question}
            >
              <span className="font-medium text-zinc-800">{question}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReportPanel({
  company,
  memo,
  onMemoChange,
}: {
  company: Company;
  memo: string;
  onMemoChange: (value: string) => void;
}) {
  return (
    <div className="space-y-5">
      <section className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <article className="rounded-lg border border-zinc-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-700" />
            <h3 className="text-xl font-semibold">{company.name} 한 장 보고서</h3>
          </div>
          <div className="mt-5 space-y-4 text-lg leading-8 text-zinc-800">
            {company.report.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </article>

        <aside className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-2 font-semibold text-emerald-950">
            <Database className="h-5 w-5" />
            데이터 출처
          </div>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-emerald-950">
            <li>• <span className="font-semibold">DART OpenAPI</span> — 회사 기본정보, 재무제표(연 4년 + 분기 5개), 공시</li>
            <li>• <span className="font-semibold">Yahoo Finance</span> — 현재가, 시가총액 (PER·PBR 계산용)</li>
            <li>• <span className="font-semibold">Naver 증권</span> — 외국인·기관 일별 순매수 + 주가 차트</li>
          </ul>
          <p className="mt-3 border-t border-emerald-200 pt-2 text-xs text-emerald-800">
            언제든 상단 <span className="font-semibold">데이터 갱신</span> 버튼으로 다시 받을 수 있습니다.
          </p>
        </aside>
      </section>

      <section className="rounded-lg border border-rose-200 bg-rose-50 p-5">
        <div className="flex items-center gap-2 text-rose-950">
          <MessageSquare className="h-5 w-5" />
          <h3 className="text-lg font-semibold">내 의견 메모</h3>
        </div>
        <p className="mt-1 text-sm text-rose-900">
          이 기업에 대한 본인 생각을 자유롭게 기록합니다. 이 브라우저에만 저장됩니다.
        </p>
        <textarea
          value={memo}
          onChange={(event) => onMemoChange(event.target.value)}
          placeholder={`예: ${company.name}는 ...라고 생각함. 다음 분기 영업이익률을 다시 확인해볼 것.`}
          className="mt-4 min-h-40 w-full rounded-md border border-rose-200 bg-white p-3 text-sm leading-6 outline-none focus:border-rose-500"
        />
      </section>
    </div>
  );
}
