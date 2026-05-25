import type { Theme } from "./themes";

type ThemeRule = {
  theme: string;
  keywords: string[];
  industryCodePrefixes?: string[];
};

const THEME_RULES: ThemeRule[] = [
  { theme: "반도체", keywords: ["반도체", "메모리", "dram", "hbm", "파운드리", "전자부품", "디스플레이", "led"], industryCodePrefixes: ["261", "262", "264"] },
  { theme: "바이오", keywords: ["바이오", "제약", "의약품", "신약", "유전자", "헬스케어", "진단", "백신"], industryCodePrefixes: ["210", "211", "212", "271"] },
  { theme: "이차전지", keywords: ["이차전지", "배터리", "양극재", "음극재", "전해질", "분리막", "ess", "전지"], industryCodePrefixes: ["282"] },
  { theme: "자동차", keywords: ["자동차", "전기차", "ev ", "모빌리티", "타이어", "부품"], industryCodePrefixes: ["301", "303", "304"] },
  { theme: "조선·기계", keywords: ["조선", "해양플랜트", "선박", "공작기계", "산업기계"], industryCodePrefixes: ["311", "292"] },
  { theme: "엔터·게임", keywords: ["엔터테인먼트", "게임", "방송", "미디어", "콘텐츠", "음반"], industryCodePrefixes: ["591", "592", "60", "631"] },
  { theme: "유통·소비재", keywords: ["유통", "백화점", "마트", "이커머스", "편의점", "식품", "화장품"], industryCodePrefixes: ["471", "472", "475", "479", "108"] },
  { theme: "건설·부동산", keywords: ["건설", "건축", "토목", "부동산"], industryCodePrefixes: ["410", "421", "412"] },
  { theme: "금융·증권", keywords: ["은행", "증권", "보험", "지주회사", "캐피탈", "카드"], industryCodePrefixes: ["641", "651", "652", "643", "642"] },
  { theme: "철강·금속", keywords: ["철강", "강관", "특수강", "비철금속"], industryCodePrefixes: ["241", "243"] },
  { theme: "화학·정유", keywords: ["석유화학", "정유", "기초화학", "수지"], industryCodePrefixes: ["201", "202", "192"] },
  { theme: "통신·IT", keywords: ["통신", "이동통신", "데이터센터", "클라우드", "saas", "소프트웨어"], industryCodePrefixes: ["612", "631", "582"] },
  { theme: "에너지·발전", keywords: ["전력", "발전", "원자력", "신재생", "태양광", "풍력", "수소"], industryCodePrefixes: ["351", "352"] },
];

export type ThemeSuggestion = {
  themeName: string;
  reason: string;
  matchedKeyword?: string;
};

export function suggestTheme(
  industryText: string,
  companyName: string,
): ThemeSuggestion | null {
  const haystack = `${industryText} ${companyName}`.toLowerCase();
  const codeMatch = industryText.match(/(\d{3,})/);
  const code = codeMatch?.[1] ?? "";

  for (const rule of THEME_RULES) {
    const hit = rule.keywords.find((k) => haystack.includes(k.toLowerCase()));
    if (hit) {
      return {
        themeName: rule.theme,
        reason: `'${hit}' 키워드 감지`,
        matchedKeyword: hit,
      };
    }
    if (code && rule.industryCodePrefixes?.some((p) => code.startsWith(p))) {
      return {
        themeName: rule.theme,
        reason: `업종코드 ${code} 매칭`,
      };
    }
  }
  return null;
}

export function resolveSuggestedTheme(
  suggestion: ThemeSuggestion,
  themes: Theme[],
): { existing: Theme | null; toCreate: string | null } {
  const existing = themes.find((t) => t.name === suggestion.themeName);
  if (existing) return { existing, toCreate: null };
  return { existing: null, toCreate: suggestion.themeName };
}
