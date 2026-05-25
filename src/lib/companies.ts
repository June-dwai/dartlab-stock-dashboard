export type Maybe<T> = T | null;

export type FinancialRow = {
  period: string;
  revenue: Maybe<number>;
  operatingProfit: Maybe<number>;
  netIncome: Maybe<number>;
  margin: Maybe<number>;
};

export type Valuation = {
  per: Maybe<number>;
  pbr: Maybe<number>;
  roe: Maybe<number>;
  debtRatio: Maybe<number>;
  asOf: string;
};

export type SpecialNote = {
  date: string;
  category: "라이센스" | "지분" | "공급계약" | "주주환원" | "자사주" | "기타";
  body: string;
};

export type ScheduleItem = {
  date: string;
  event: string;
  note: string;
};

export type ExternalLink = {
  category: "제품 리뷰" | "시승기" | "사용기" | "시장 전망" | "임상·분석" | "기타";
  title: string;
  source: string;
  summary: string;
};

export type BusinessBlock = {
  title: string;
  body: string;
  evidence: string;
};

export type Filing = {
  title: string;
  date: string;
  type: string;
  note: string;
  url?: string;
};

export type Risk = {
  title: string;
  level: "낮음" | "보통" | "높음";
  body: string;
};

export type InvestorDayRow = {
  date: string;
  foreignerNet: Maybe<number>;
  institutionNet: Maybe<number>;
  foreignerHoldingPct: Maybe<number>;
};

export type InvestorActivity = {
  source: "naver";
  rows: InvestorDayRow[];
  latest: InvestorDayRow | null;
  sum5d: { foreigner: Maybe<number>; institution: Maybe<number> };
  sum20d: { foreigner: Maybe<number>; institution: Maybe<number> };
  note: string;
};

export type Company = {
  ticker: string;
  name: string;
  corpCode?: string;
  market: string;
  industry: string;
  headline: string;
  oneLine: string;
  updatedAt: string;
  grade: string;
  gradeLabel: string;
  score: number;
  metrics: {
    label: string;
    value: string;
    change: string;
    tone: "good" | "watch" | "neutral";
  }[];
  valuation: Valuation;
  financials: FinancialRow[];
  quarterly: FinancialRow[];
  ratios: {
    label: string;
    value: string;
    helper: string;
    progress: number;
    tone: "good" | "watch" | "neutral";
  }[];
  specialNotes: SpecialNote[];
  schedule: ScheduleItem[];
  external: ExternalLink[];
  business: BusinessBlock[];
  filings: Filing[];
  risks: Risk[];
  report: string[];
  nextQuestions: string[];
  investorActivity?: InvestorActivity | null;
};

// 빌트인 회사는 기본 정보만 포함한 스켈레톤입니다.
// 사용자가 "데이터 갱신"을 누르면 DART + Yahoo + Naver에서 실데이터를 가져와 채웁니다.
function skeleton(
  ticker: string,
  name: string,
  industry: string,
  market: string = "KOSPI",
): Company {
  return {
    ticker,
    name,
    market,
    industry,
    headline: "",
    oneLine: "",
    updatedAt: "",
    grade: "—",
    gradeLabel: "데이터 갱신 필요",
    score: 0,
    metrics: [],
    valuation: { per: null, pbr: null, roe: null, debtRatio: null, asOf: "" },
    financials: [],
    quarterly: [],
    ratios: [],
    specialNotes: [],
    schedule: [],
    external: [],
    business: [],
    filings: [],
    risks: [],
    report: [],
    nextQuestions: [],
    investorActivity: null,
  };
}

export const companies: Company[] = [
  skeleton("005930", "삼성전자", "반도체 · 스마트폰"),
  skeleton("000660", "SK하이닉스", "메모리 반도체"),
  skeleton("068270", "셀트리온", "바이오시밀러 · 제약"),
];
