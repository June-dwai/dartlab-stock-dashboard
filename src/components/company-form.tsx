"use client";

import {
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import type {
  BusinessBlock,
  Company,
  ExternalLink,
  Filing,
  FinancialRow,
  Maybe,
  Risk,
  ScheduleItem,
  SpecialNote,
  Valuation,
} from "@/lib/companies";
import { resolveSuggestedTheme, suggestTheme } from "@/lib/theme-classifier";
import { UNCATEGORIZED_THEME_ID, type Theme } from "@/lib/themes";

type Tone = "good" | "watch" | "neutral";

type TabId =
  | "basic"
  | "valuation"
  | "financials"
  | "metrics"
  | "business"
  | "risk"
  | "report";

const tabs: { id: TabId; label: string }[] = [
  { id: "basic", label: "기본정보" },
  { id: "valuation", label: "가치지표" },
  { id: "financials", label: "재무제표" },
  { id: "metrics", label: "메트릭·비율" },
  { id: "business", label: "사업·공시·특이" },
  { id: "risk", label: "위험·일정·외부" },
  { id: "report", label: "보고서·질문" },
];

const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: "good", label: "양호" },
  { value: "neutral", label: "중립" },
  { value: "watch", label: "주의" },
];

const LEVEL_OPTIONS: Risk["level"][] = ["낮음", "보통", "높음"];

const NOTE_CATEGORIES: SpecialNote["category"][] = [
  "라이센스",
  "지분",
  "공급계약",
  "주주환원",
  "자사주",
  "기타",
];

const EXTERNAL_CATEGORIES: ExternalLink["category"][] = [
  "제품 리뷰",
  "시승기",
  "사용기",
  "시장 전망",
  "임상·분석",
  "기타",
];

const MARKET_OPTIONS = ["KOSPI", "KOSDAQ", "KONEX", "기타"];

function parseMaybeNumber(s: string): Maybe<number> {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function maybeNumberToString(v: Maybe<number>): string {
  return v === null ? "" : String(v);
}

export function CompanyForm({
  open,
  mode,
  initial,
  initialThemeId,
  themes,
  onAddTheme,
  existingTickers,
  onClose,
  onSave,
}: {
  open: boolean;
  mode: "add" | "edit";
  initial: Company;
  initialThemeId: string | null;
  themes: Theme[];
  onAddTheme: (name: string) => Theme | null;
  existingTickers: Set<string>;
  onClose: () => void;
  onSave: (company: Company, themeId: string | null) => void;
}) {
  const [draft, setDraft] = useState<Company>(initial);
  const [themeId, setThemeId] = useState<string>(initialThemeId ?? UNCATEGORIZED_THEME_ID);
  const [activeTab, setActiveTab] = useState<TabId>("basic");
  const [dartQuery, setDartQuery] = useState(initial.ticker || initial.name || "");
  const [dartLoading, setDartLoading] = useState(false);
  const [dartMessage, setDartMessage] = useState<string | null>(null);
  const [dartWarnings, setDartWarnings] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!open) return null;

  const update = <K extends keyof Company>(key: K, value: Company[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const updateValuation = <K extends keyof Valuation>(key: K, value: Valuation[K]) => {
    setDraft((prev) => ({ ...prev, valuation: { ...prev.valuation, [key]: value } }));
  };

  const submit = () => {
    const ticker = draft.ticker.trim();
    if (!ticker) {
      setValidationError("종목코드를 입력해주세요.");
      setActiveTab("basic");
      return;
    }
    if (!draft.name.trim()) {
      setValidationError("회사명을 입력해주세요.");
      setActiveTab("basic");
      return;
    }
    if (mode === "add" && existingTickers.has(ticker)) {
      setValidationError(`이미 등록된 종목코드입니다 (${ticker}).`);
      setActiveTab("basic");
      return;
    }
    onSave({ ...draft, ticker }, themeId === UNCATEGORIZED_THEME_ID ? null : themeId);
  };

  const handleAddThemeInForm = (name: string) => {
    const created = onAddTheme(name);
    if (created) setThemeId(created.id);
  };

  const runDartFetch = async () => {
    const q = dartQuery.trim();
    if (!q) {
      setDartMessage("종목코드 또는 회사명을 입력해주세요.");
      return;
    }
    setDartLoading(true);
    setDartMessage(null);
    setDartWarnings([]);
    try {
      const res = await fetch(`/api/dart/fetch?query=${encodeURIComponent(q)}`);
      const data = (await res.json()) as
        | {
            partial: Partial<Company>;
            warnings?: string[];
            corp?: { corpName: string };
          }
        | { error: string };
      if (!res.ok || "error" in data) {
        setDartMessage("error" in data ? data.error : `DART 조회 실패 (HTTP ${res.status})`);
        return;
      }
      // Auto-classify theme if user hasn't picked one
      const industryText = data.partial.industry ?? "";
      const corpName = data.partial.name ?? "";
      let themeNote: string | null = null;
      if (themeId === UNCATEGORIZED_THEME_ID && (industryText || corpName)) {
        const suggestion = suggestTheme(industryText, corpName);
        if (suggestion) {
          const resolved = resolveSuggestedTheme(suggestion, themes);
          if (resolved.existing) {
            setThemeId(resolved.existing.id);
            themeNote = `테마 자동 분류: '${suggestion.themeName}' (${suggestion.reason})`;
          } else if (resolved.toCreate) {
            const created = onAddTheme(resolved.toCreate);
            if (created) {
              setThemeId(created.id);
              themeNote = `테마 자동 생성·분류: '${suggestion.themeName}' (${suggestion.reason})`;
            }
          }
        }
      }

      setDraft((prev) => {
        const isPlaceholderGrade = !prev.grade || prev.grade === "—";
        const isPlaceholderLabel = !prev.gradeLabel || prev.gradeLabel === "데이터 확인 중";
        return {
          ...prev,
          ticker: data.partial.ticker || prev.ticker,
          name: data.partial.name || prev.name,
          corpCode: data.partial.corpCode || prev.corpCode,
          market: data.partial.market || prev.market,
          industry: data.partial.industry || prev.industry,
          updatedAt: data.partial.updatedAt || prev.updatedAt,
          headline: prev.headline || data.partial.headline || "",
          oneLine: prev.oneLine || data.partial.oneLine || "",
          grade: isPlaceholderGrade ? (data.partial.grade ?? prev.grade) : prev.grade,
          gradeLabel: isPlaceholderLabel ? (data.partial.gradeLabel ?? prev.gradeLabel) : prev.gradeLabel,
          score: prev.score === 0 ? (data.partial.score ?? prev.score) : prev.score,
          valuation: {
            ...prev.valuation,
            per: data.partial.valuation?.per ?? prev.valuation.per,
            pbr: data.partial.valuation?.pbr ?? prev.valuation.pbr,
            roe: data.partial.valuation?.roe ?? prev.valuation.roe,
            debtRatio: data.partial.valuation?.debtRatio ?? prev.valuation.debtRatio,
            asOf: data.partial.valuation?.asOf || prev.valuation.asOf,
          },
          financials: data.partial.financials?.length ? data.partial.financials : prev.financials,
          quarterly:
            data.partial.quarterly?.length && prev.quarterly.length
              ? prev.quarterly.map((row) => {
                  const match = data.partial.quarterly!.find((q) => q.period === row.period);
                  return match ?? row;
                })
              : data.partial.quarterly?.length
                ? data.partial.quarterly
                : prev.quarterly,
          filings: data.partial.filings?.length ? data.partial.filings : prev.filings,
          metrics: prev.metrics.length === 0 && data.partial.metrics?.length ? data.partial.metrics : prev.metrics,
          ratios: prev.ratios.length === 0 && data.partial.ratios?.length ? data.partial.ratios : prev.ratios,
          report: prev.report.length === 0 && data.partial.report?.length ? data.partial.report : prev.report,
          nextQuestions:
            prev.nextQuestions.length === 0 && data.partial.nextQuestions?.length
              ? data.partial.nextQuestions
              : prev.nextQuestions,
          investorActivity: data.partial.investorActivity ?? prev.investorActivity ?? null,
        };
      });
      setDartMessage(`${data.corp?.corpName ?? q} 정보를 불러왔습니다.`);
      setDartWarnings([
        ...(themeNote ? [themeNote] : []),
        ...(data.warnings ?? []),
      ]);
    } catch (err) {
      setDartMessage(`네트워크 오류: ${String(err)}`);
    } finally {
      setDartLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-6 py-4">
          <h2 className="text-lg font-semibold">
            {mode === "add" ? "기업 추가" : `${draft.name || draft.ticker} 수정`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-zinc-200 bg-zinc-50 px-4 py-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "bg-zinc-950 text-white"
                  : "text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === "basic" && (
            <BasicInfoTab
              draft={draft}
              onUpdate={update}
              themes={themes}
              themeId={themeId}
              onThemeChange={setThemeId}
              onAddTheme={handleAddThemeInForm}
              dartQuery={dartQuery}
              setDartQuery={setDartQuery}
              dartLoading={dartLoading}
              dartMessage={dartMessage}
              dartWarnings={dartWarnings}
              onRunDart={runDartFetch}
            />
          )}
          {activeTab === "valuation" && (
            <ValuationTab draft={draft} onUpdate={updateValuation} />
          )}
          {activeTab === "financials" && (
            <FinancialsTab
              draft={draft}
              onUpdate={(key, rows) => update(key, rows)}
            />
          )}
          {activeTab === "metrics" && (
            <MetricsTab draft={draft} onUpdate={update} />
          )}
          {activeTab === "business" && (
            <BusinessTab draft={draft} onUpdate={update} />
          )}
          {activeTab === "risk" && <RiskTab draft={draft} onUpdate={update} />}
          {activeTab === "report" && (
            <ReportTab draft={draft} onUpdate={update} />
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-3">
          <span className="text-xs text-rose-700">{validationError ?? ""}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
            >
              취소
            </button>
            <button
              type="button"
              onClick={submit}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              저장
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className}`}>
      <span className="font-semibold text-zinc-800">{label}</span>
      {children}
      {hint ? <span className="text-xs text-zinc-500">{hint}</span> : null}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 ${
        props.className ?? ""
      }`}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-20 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 ${
        props.className ?? ""
      }`}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 ${
        props.className ?? ""
      }`}
    />
  );
}

function BasicInfoTab({
  draft,
  onUpdate,
  themes,
  themeId,
  onThemeChange,
  onAddTheme,
  dartQuery,
  setDartQuery,
  dartLoading,
  dartMessage,
  dartWarnings,
  onRunDart,
}: {
  draft: Company;
  onUpdate: <K extends keyof Company>(key: K, value: Company[K]) => void;
  themes: Theme[];
  themeId: string;
  onThemeChange: (v: string) => void;
  onAddTheme: (name: string) => void;
  dartQuery: string;
  setDartQuery: (v: string) => void;
  dartLoading: boolean;
  dartMessage: string | null;
  dartWarnings: string[];
  onRunDart: () => void;
}) {
  const [newTheme, setNewTheme] = useState("");
  const [showNew, setShowNew] = useState(false);
  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
          <Search className="h-4 w-4" />
          DART + Yahoo 자동 조회
        </div>
        <p className="mt-1 text-xs text-emerald-900">
          종목코드(예: 006400) 또는 회사명(예: 삼성SDI)을 입력하면 DART에서 기본정보·재무제표·공시·ROE·부채비율을, Yahoo Finance에서 PER·PBR·현재가를 가져옵니다.
          서버에 <code className="rounded bg-emerald-100 px-1 py-0.5">DART_API_KEY</code> 환경변수가 필요합니다 (Yahoo는 키 불필요).
        </p>
        <div className="mt-3 flex gap-2">
          <TextInput
            value={dartQuery}
            onChange={(e) => setDartQuery(e.target.value)}
            placeholder="종목코드 또는 회사명"
            className="flex-1"
          />
          <button
            type="button"
            disabled={dartLoading}
            onClick={onRunDart}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-zinc-400"
          >
            {dartLoading ? "조회 중..." : "조회"}
          </button>
        </div>
        {dartMessage ? (
          <p className="mt-3 text-xs font-medium text-emerald-900">{dartMessage}</p>
        ) : null}
        {dartWarnings.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-800">
            {dartWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="종목코드 *">
          <TextInput
            value={draft.ticker}
            onChange={(e) => onUpdate("ticker", e.target.value)}
            placeholder="006400"
          />
        </Field>
        <Field label="회사명 *">
          <TextInput
            value={draft.name}
            onChange={(e) => onUpdate("name", e.target.value)}
            placeholder="삼성SDI"
          />
        </Field>
        <Field label="시장">
          <Select
            value={draft.market}
            onChange={(e) => onUpdate("market", e.target.value)}
          >
            {MARKET_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="업종">
          <TextInput
            value={draft.industry}
            onChange={(e) => onUpdate("industry", e.target.value)}
            placeholder="이차전지 · 전자재료"
          />
        </Field>
        <Field label="헤드라인" className="sm:col-span-2">
          <TextInput
            value={draft.headline}
            onChange={(e) => onUpdate("headline", e.target.value)}
            placeholder="EV·ESS 양축 성장이 보이는 배터리 셀 제조사"
          />
        </Field>
        <Field label="한 줄 요약" className="sm:col-span-2">
          <TextArea
            value={draft.oneLine}
            onChange={(e) => onUpdate("oneLine", e.target.value)}
            placeholder="아버지께 한 줄로 설명할 핵심 한 문장"
          />
        </Field>
        <Field label="등급">
          <TextInput
            value={draft.grade}
            onChange={(e) => onUpdate("grade", e.target.value)}
            placeholder="A / B+ / B / 등"
          />
        </Field>
        <Field label="등급 설명">
          <TextInput
            value={draft.gradeLabel}
            onChange={(e) => onUpdate("gradeLabel", e.target.value)}
            placeholder="재무 안전권"
          />
        </Field>
        <Field label="종합 점수">
          <TextInput
            type="number"
            value={String(draft.score)}
            onChange={(e) => onUpdate("score", Number(e.target.value) || 0)}
            placeholder="0~100"
          />
        </Field>
        <Field label="데이터 기준">
          <TextInput
            value={draft.updatedAt}
            onChange={(e) => onUpdate("updatedAt", e.target.value)}
            placeholder="2026.05.24"
          />
        </Field>
        <Field label="테마 / 그룹" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            <Select
              value={themeId}
              onChange={(e) => onThemeChange(e.target.value)}
              className="min-w-40 flex-1"
            >
              <option value={UNCATEGORIZED_THEME_ID}>미분류</option>
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            {showNew ? (
              <form
                className="flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newTheme.trim()) return;
                  onAddTheme(newTheme);
                  setNewTheme("");
                  setShowNew(false);
                }}
              >
                <TextInput
                  autoFocus
                  value={newTheme}
                  onChange={(e) => setNewTheme(e.target.value)}
                  placeholder="새 테마 이름"
                  className="w-44"
                />
                <button
                  type="submit"
                  className="rounded-md bg-emerald-600 px-2.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  추가
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNew(false);
                    setNewTheme("");
                  }}
                  className="rounded-md border border-zinc-300 bg-white px-2.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
                >
                  취소
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowNew(true)}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
              >
                <Plus className="h-3 w-3" />새 테마 만들기
              </button>
            )}
          </div>
        </Field>
      </div>
    </div>
  );
}

function ValuationTab({
  draft,
  onUpdate,
}: {
  draft: Company;
  onUpdate: <K extends keyof Valuation>(key: K, value: Valuation[K]) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="PER (배)" hint="이익 대비 주가. 비워두면 NA로 표시됩니다.">
        <TextInput
          value={maybeNumberToString(draft.valuation.per)}
          onChange={(e) => onUpdate("per", parseMaybeNumber(e.target.value))}
          placeholder="13.2"
        />
      </Field>
      <Field label="PBR (배)" hint="자본 대비 주가">
        <TextInput
          value={maybeNumberToString(draft.valuation.pbr)}
          onChange={(e) => onUpdate("pbr", parseMaybeNumber(e.target.value))}
          placeholder="1.4"
        />
      </Field>
      <Field label="ROE (%)">
        <TextInput
          value={maybeNumberToString(draft.valuation.roe)}
          onChange={(e) => onUpdate("roe", parseMaybeNumber(e.target.value))}
          placeholder="11.2"
        />
      </Field>
      <Field label="부채비율 (%)">
        <TextInput
          value={maybeNumberToString(draft.valuation.debtRatio)}
          onChange={(e) => onUpdate("debtRatio", parseMaybeNumber(e.target.value))}
          placeholder="29.9"
        />
      </Field>
      <Field label="기준일" className="sm:col-span-2">
        <TextInput
          value={draft.valuation.asOf}
          onChange={(e) => onUpdate("asOf", e.target.value)}
          placeholder="2026.05.24"
        />
      </Field>
    </div>
  );
}

function FinancialsTab({
  draft,
  onUpdate,
}: {
  draft: Company;
  onUpdate: <K extends keyof Company>(key: K, value: Company[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <FinancialRowsEditor
        title="연간 재무제표"
        hint="단위: 조원 (내부 저장). 표시는 억원. 비공시는 비워두면 NA로 표시됩니다."
        rows={draft.financials}
        onChange={(rows) => onUpdate("financials", rows)}
        defaultPeriod={(idx) => String(2022 + idx)}
      />
      <FinancialRowsEditor
        title="분기 재무제표"
        hint="2026 Q1 등 최근 5개 분기를 추천합니다."
        rows={draft.quarterly}
        onChange={(rows) => onUpdate("quarterly", rows)}
        defaultPeriod={(idx) => `2026 Q${idx + 1}`}
      />
    </div>
  );
}

function FinancialRowsEditor({
  title,
  hint,
  rows,
  onChange,
  defaultPeriod,
}: {
  title: string;
  hint?: string;
  rows: FinancialRow[];
  onChange: (rows: FinancialRow[]) => void;
  defaultPeriod: (idx: number) => string;
}) {
  const update = (idx: number, patch: Partial<FinancialRow>) => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const remove = (idx: number) => onChange(rows.filter((_, i) => i !== idx));
  const add = () =>
    onChange([
      ...rows,
      {
        period: defaultPeriod(rows.length),
        revenue: null,
        operatingProfit: null,
        netIncome: null,
        margin: null,
      },
    ]);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-base font-semibold">{title}</h4>
          {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
        </div>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
        >
          <Plus className="h-3 w-3" />
          행 추가
        </button>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs text-zinc-500">
              <th className="px-2 py-2 text-left font-semibold">기간</th>
              <th className="px-2 py-2 text-left font-semibold">매출</th>
              <th className="px-2 py-2 text-left font-semibold">영업이익</th>
              <th className="px-2 py-2 text-left font-semibold">순이익</th>
              <th className="px-2 py-2 text-left font-semibold">영업이익률(%)</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${idx}-${row.period}`} className="border-b border-zinc-100">
                <td className="px-1 py-1">
                  <TextInput
                    value={row.period}
                    onChange={(e) => update(idx, { period: e.target.value })}
                  />
                </td>
                <td className="px-1 py-1">
                  <TextInput
                    value={maybeNumberToString(row.revenue)}
                    onChange={(e) => update(idx, { revenue: parseMaybeNumber(e.target.value) })}
                  />
                </td>
                <td className="px-1 py-1">
                  <TextInput
                    value={maybeNumberToString(row.operatingProfit)}
                    onChange={(e) =>
                      update(idx, { operatingProfit: parseMaybeNumber(e.target.value) })
                    }
                  />
                </td>
                <td className="px-1 py-1">
                  <TextInput
                    value={maybeNumberToString(row.netIncome)}
                    onChange={(e) => update(idx, { netIncome: parseMaybeNumber(e.target.value) })}
                  />
                </td>
                <td className="px-1 py-1">
                  <TextInput
                    value={maybeNumberToString(row.margin)}
                    onChange={(e) => update(idx, { margin: parseMaybeNumber(e.target.value) })}
                  />
                </td>
                <td className="px-1 py-1 text-right">
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"
                    aria-label="행 삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-6 text-center text-sm text-zinc-500">
                  행이 없습니다. &quot;행 추가&quot;로 만들어주세요.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MetricsTab({
  draft,
  onUpdate,
}: {
  draft: Company;
  onUpdate: <K extends keyof Company>(key: K, value: Company[K]) => void;
}) {
  const updateMetric = (idx: number, patch: Partial<Company["metrics"][number]>) => {
    onUpdate(
      "metrics",
      draft.metrics.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    );
  };
  const updateRatio = (idx: number, patch: Partial<Company["ratios"][number]>) => {
    onUpdate(
      "ratios",
      draft.ratios.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );
  };

  return (
    <div className="space-y-6">
      <ArraySection
        title="요약 메트릭"
        hint="한눈에 탭 상단의 카드 4개에 표시됩니다."
        items={draft.metrics}
        onAdd={() =>
          onUpdate("metrics", [
            ...draft.metrics,
            { label: "", value: "", change: "", tone: "neutral" },
          ])
        }
        onRemove={(idx) =>
          onUpdate("metrics", draft.metrics.filter((_, i) => i !== idx))
        }
        renderItem={(m, idx) => (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="라벨">
              <TextInput
                value={m.label}
                onChange={(e) => updateMetric(idx, { label: e.target.value })}
                placeholder="매출"
              />
            </Field>
            <Field label="값">
              <TextInput
                value={m.value}
                onChange={(e) => updateMetric(idx, { value: e.target.value })}
                placeholder="349.8조"
              />
            </Field>
            <Field label="변화">
              <TextInput
                value={m.change}
                onChange={(e) => updateMetric(idx, { change: e.target.value })}
                placeholder="전년 대비 +16.3%"
              />
            </Field>
            <Field label="톤">
              <Select
                value={m.tone}
                onChange={(e) => updateMetric(idx, { tone: e.target.value as Tone })}
              >
                {TONE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
      />

      <ArraySection
        title="체크 포인트 (비율)"
        hint="한눈에 탭 오른쪽에 진행률 막대로 표시됩니다."
        items={draft.ratios}
        onAdd={() =>
          onUpdate("ratios", [
            ...draft.ratios,
            { label: "", value: "", helper: "", progress: 50, tone: "neutral" },
          ])
        }
        onRemove={(idx) =>
          onUpdate("ratios", draft.ratios.filter((_, i) => i !== idx))
        }
        renderItem={(r, idx) => (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="라벨">
              <TextInput
                value={r.label}
                onChange={(e) => updateRatio(idx, { label: e.target.value })}
              />
            </Field>
            <Field label="값">
              <TextInput
                value={r.value}
                onChange={(e) => updateRatio(idx, { value: e.target.value })}
              />
            </Field>
            <Field label="설명">
              <TextInput
                value={r.helper}
                onChange={(e) => updateRatio(idx, { helper: e.target.value })}
              />
            </Field>
            <Field label="진행률(0-100)">
              <TextInput
                type="number"
                value={String(r.progress)}
                onChange={(e) => updateRatio(idx, { progress: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="톤">
              <Select
                value={r.tone}
                onChange={(e) => updateRatio(idx, { tone: e.target.value as Tone })}
              >
                {TONE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
      />
    </div>
  );
}

function BusinessTab({
  draft,
  onUpdate,
}: {
  draft: Company;
  onUpdate: <K extends keyof Company>(key: K, value: Company[K]) => void;
}) {
  const updateBusiness = (idx: number, patch: Partial<BusinessBlock>) => {
    onUpdate(
      "business",
      draft.business.map((b, i) => (i === idx ? { ...b, ...patch } : b)),
    );
  };
  const updateFiling = (idx: number, patch: Partial<Filing>) => {
    onUpdate(
      "filings",
      draft.filings.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    );
  };
  const updateNote = (idx: number, patch: Partial<SpecialNote>) => {
    onUpdate(
      "specialNotes",
      draft.specialNotes.map((n, i) => (i === idx ? { ...n, ...patch } : n)),
    );
  };

  return (
    <div className="space-y-6">
      <ArraySection
        title="사업보고서 블록"
        items={draft.business}
        onAdd={() =>
          onUpdate("business", [...draft.business, { title: "", body: "", evidence: "" }])
        }
        onRemove={(idx) =>
          onUpdate("business", draft.business.filter((_, i) => i !== idx))
        }
        renderItem={(b, idx) => (
          <div className="grid gap-2">
            <Field label="제목">
              <TextInput
                value={b.title}
                onChange={(e) => updateBusiness(idx, { title: e.target.value })}
              />
            </Field>
            <Field label="설명">
              <TextArea
                value={b.body}
                onChange={(e) => updateBusiness(idx, { body: e.target.value })}
              />
            </Field>
            <Field label="근거">
              <TextInput
                value={b.evidence}
                onChange={(e) => updateBusiness(idx, { evidence: e.target.value })}
              />
            </Field>
          </div>
        )}
      />

      <ArraySection
        title="공시 (DART)"
        items={draft.filings}
        onAdd={() =>
          onUpdate("filings", [
            ...draft.filings,
            { title: "", date: "", type: "정기공시", note: "" },
          ])
        }
        onRemove={(idx) =>
          onUpdate("filings", draft.filings.filter((_, i) => i !== idx))
        }
        renderItem={(f, idx) => (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="제목">
              <TextInput
                value={f.title}
                onChange={(e) => updateFiling(idx, { title: e.target.value })}
              />
            </Field>
            <Field label="날짜">
              <TextInput
                value={f.date}
                onChange={(e) => updateFiling(idx, { date: e.target.value })}
                placeholder="2026.03.18"
              />
            </Field>
            <Field label="구분">
              <TextInput
                value={f.type}
                onChange={(e) => updateFiling(idx, { type: e.target.value })}
              />
            </Field>
            <Field label="메모">
              <TextInput
                value={f.note}
                onChange={(e) => updateFiling(idx, { note: e.target.value })}
              />
            </Field>
          </div>
        )}
      />

      <ArraySection
        title="특이사항 (기본 기록)"
        hint="라이센스·지분·계약 등. 사용자 직접 추가는 재무제표 탭의 '특이사항 직접 추가'에서 합니다."
        items={draft.specialNotes}
        onAdd={() =>
          onUpdate("specialNotes", [
            ...draft.specialNotes,
            { date: "", category: "기타", body: "" },
          ])
        }
        onRemove={(idx) =>
          onUpdate("specialNotes", draft.specialNotes.filter((_, i) => i !== idx))
        }
        renderItem={(n, idx) => (
          <div className="grid gap-2 sm:grid-cols-[140px_140px_1fr]">
            <Field label="날짜">
              <TextInput
                value={n.date}
                onChange={(e) => updateNote(idx, { date: e.target.value })}
              />
            </Field>
            <Field label="구분">
              <Select
                value={n.category}
                onChange={(e) => updateNote(idx, { category: e.target.value as SpecialNote["category"] })}
              >
                {NOTE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="내용">
              <TextInput
                value={n.body}
                onChange={(e) => updateNote(idx, { body: e.target.value })}
              />
            </Field>
          </div>
        )}
      />
    </div>
  );
}

function RiskTab({
  draft,
  onUpdate,
}: {
  draft: Company;
  onUpdate: <K extends keyof Company>(key: K, value: Company[K]) => void;
}) {
  const updateRisk = (idx: number, patch: Partial<Risk>) => {
    onUpdate(
      "risks",
      draft.risks.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );
  };
  const updateSched = (idx: number, patch: Partial<ScheduleItem>) => {
    onUpdate(
      "schedule",
      draft.schedule.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    );
  };
  const updateExt = (idx: number, patch: Partial<ExternalLink>) => {
    onUpdate(
      "external",
      draft.external.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    );
  };

  return (
    <div className="space-y-6">
      <ArraySection
        title="위험 요인"
        items={draft.risks}
        onAdd={() =>
          onUpdate("risks", [...draft.risks, { title: "", level: "보통", body: "" }])
        }
        onRemove={(idx) => onUpdate("risks", draft.risks.filter((_, i) => i !== idx))}
        renderItem={(r, idx) => (
          <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
            <Field label="제목">
              <TextInput
                value={r.title}
                onChange={(e) => updateRisk(idx, { title: e.target.value })}
              />
            </Field>
            <Field label="레벨">
              <Select
                value={r.level}
                onChange={(e) => updateRisk(idx, { level: e.target.value as Risk["level"] })}
              >
                {LEVEL_OPTIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="설명" className="sm:col-span-2">
              <TextArea
                value={r.body}
                onChange={(e) => updateRisk(idx, { body: e.target.value })}
              />
            </Field>
          </div>
        )}
      />

      <ArraySection
        title="실적 · IR 일정"
        items={draft.schedule}
        onAdd={() =>
          onUpdate("schedule", [...draft.schedule, { date: "", event: "", note: "" }])
        }
        onRemove={(idx) =>
          onUpdate("schedule", draft.schedule.filter((_, i) => i !== idx))
        }
        renderItem={(s, idx) => (
          <div className="grid gap-2 sm:grid-cols-[140px_1fr_1fr]">
            <Field label="날짜">
              <TextInput
                value={s.date}
                onChange={(e) => updateSched(idx, { date: e.target.value })}
              />
            </Field>
            <Field label="이벤트">
              <TextInput
                value={s.event}
                onChange={(e) => updateSched(idx, { event: e.target.value })}
              />
            </Field>
            <Field label="메모">
              <TextInput
                value={s.note}
                onChange={(e) => updateSched(idx, { note: e.target.value })}
              />
            </Field>
          </div>
        )}
      />

      <ArraySection
        title="외부 정보 (제품 리뷰 · 시장 전망)"
        items={draft.external}
        onAdd={() =>
          onUpdate("external", [
            ...draft.external,
            { category: "제품 리뷰", title: "", source: "", summary: "" },
          ])
        }
        onRemove={(idx) =>
          onUpdate("external", draft.external.filter((_, i) => i !== idx))
        }
        renderItem={(e, idx) => (
          <div className="grid gap-2 sm:grid-cols-[140px_1fr_180px]">
            <Field label="구분">
              <Select
                value={e.category}
                onChange={(ev) => updateExt(idx, { category: ev.target.value as ExternalLink["category"] })}
              >
                {EXTERNAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="제목">
              <TextInput
                value={e.title}
                onChange={(ev) => updateExt(idx, { title: ev.target.value })}
              />
            </Field>
            <Field label="출처">
              <TextInput
                value={e.source}
                onChange={(ev) => updateExt(idx, { source: ev.target.value })}
              />
            </Field>
            <Field label="요약" className="sm:col-span-3">
              <TextArea
                value={e.summary}
                onChange={(ev) => updateExt(idx, { summary: ev.target.value })}
              />
            </Field>
          </div>
        )}
      />
    </div>
  );
}

function ReportTab({
  draft,
  onUpdate,
}: {
  draft: Company;
  onUpdate: <K extends keyof Company>(key: K, value: Company[K]) => void;
}) {
  const reportText = useMemo(() => draft.report.join("\n"), [draft.report]);
  const questionsText = useMemo(() => draft.nextQuestions.join("\n"), [draft.nextQuestions]);

  return (
    <div className="space-y-5">
      <Field
        label="한 장 보고서 (한 줄에 한 문단)"
        hint="아버지께 설명할 때 쓰는 문장들"
      >
        <TextArea
          value={reportText}
          onChange={(e) =>
            onUpdate(
              "report",
              e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
            )
          }
          className="min-h-40"
          placeholder={"이 기업은 ...\n다음으로 확인할 것은 ..."}
        />
      </Field>

      <Field label="확인 질문 (한 줄에 하나)">
        <TextArea
          value={questionsText}
          onChange={(e) =>
            onUpdate(
              "nextQuestions",
              e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
            )
          }
          className="min-h-32"
          placeholder={"영업이익률은 계속 회복될까?\n부채비율은 충분히 낮은가?"}
        />
      </Field>
    </div>
  );
}

function ArraySection<T>({
  title,
  hint,
  items,
  onAdd,
  onRemove,
  renderItem,
}: {
  title: string;
  hint?: string;
  items: T[];
  onAdd: () => void;
  onRemove: (idx: number) => void;
  renderItem: (item: T, idx: number) => React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold">{title}</h4>
          {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
        >
          <Plus className="h-3 w-3" />
          추가
        </button>
      </div>
      <div className="mt-3 space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="relative rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="absolute right-2 top-2 rounded-md p-1.5 text-rose-600 hover:bg-rose-100"
              aria-label="삭제"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            {renderItem(item, idx)}
          </div>
        ))}
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 bg-white px-3 py-6 text-center text-sm text-zinc-500">
            항목이 없습니다. &quot;추가&quot;를 눌러 만들어주세요.
          </p>
        ) : null}
      </div>
    </section>
  );
}
