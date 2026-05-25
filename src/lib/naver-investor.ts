import "server-only";

export type InvestorDayRow = {
  date: string;
  foreignerNet: number | null;
  institutionNet: number | null;
  foreignerHoldingPct: number | null;
};

export type InvestorSummary = {
  source: "naver";
  rows: InvestorDayRow[];
  latest: InvestorDayRow | null;
  sum5d: { foreigner: number | null; institution: number | null };
  sum20d: { foreigner: number | null; institution: number | null };
  note: string;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

function parseNumber(s: string): number | null {
  const cleaned = s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, "").replace(/,/g, "").trim();
  if (!cleaned || cleaned === "-") return null;
  const negative = cleaned.startsWith("-");
  const numeric = cleaned.replace(/^[-+]/, "").replace(/%/g, "");
  const n = parseFloat(numeric);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}

function parsePage(html: string): InvestorDayRow[] {
  const rows: InvestorDayRow[] = [];
  const rowRegex = /<tr onMouseOver="[^"]*"[^>]*>([\s\S]*?)<\/tr>/g;
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;

  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(html)) !== null) {
    const rowHtml = match[1];
    const cells: string[] = [];
    cellRegex.lastIndex = 0;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(stripTags(cellMatch[1]));
    }
    if (cells.length < 9) continue;
    const date = cells[0];
    if (!/^\d{4}\.\d{2}\.\d{2}$/.test(date)) continue;
    rows.push({
      date,
      institutionNet: parseNumber(cells[5]),
      foreignerNet: parseNumber(cells[6]),
      foreignerHoldingPct: parseNumber(cells[8]),
    });
  }
  return rows;
}

export async function fetchNaverInvestor(ticker: string): Promise<InvestorSummary | null> {
  if (!/^\d+$/.test(ticker)) return null;
  const padded = ticker.length < 6 ? ticker.padStart(6, "0") : ticker;

  const rows: InvestorDayRow[] = [];
  const diagnostics: string[] = [];
  for (const page of [1, 2]) {
    try {
      const res = await fetch(
        `https://finance.naver.com/item/frgn.naver?code=${padded}&page=${page}`,
        {
          headers: {
            "User-Agent": UA,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
            "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
            Referer: `https://finance.naver.com/item/main.naver?code=${padded}`,
          },
          cache: "no-store",
        },
      );
      if (!res.ok) {
        diagnostics.push(`page${page}: HTTP ${res.status}`);
        break;
      }
      const buf = await res.arrayBuffer();
      let html: string;
      try {
        html = new TextDecoder("euc-kr").decode(buf);
      } catch {
        try {
          html = new TextDecoder("cp949").decode(buf);
        } catch {
          html = new TextDecoder("utf-8").decode(buf);
        }
      }
      diagnostics.push(`page${page}: ${buf.byteLength}B, onMouseOver=${(html.match(/onMouseOver=/g) ?? []).length}`);
      const pageRows = parsePage(html);
      diagnostics.push(`page${page}: parsed ${pageRows.length} rows`);
      if (pageRows.length === 0) break;
      rows.push(...pageRows);
    } catch (err) {
      diagnostics.push(`page${page}: error ${String(err)}`);
      break;
    }
  }

  if (rows.length === 0) {
    console.warn("[naver-investor] no rows for", padded, "—", diagnostics.join("; "));
    return null;
  }

  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const sum = (key: "foreignerNet" | "institutionNet", n: number): number | null => {
    const slice = rows.slice(0, n);
    let total = 0;
    let valid = 0;
    for (const r of slice) {
      if (r[key] !== null) {
        total += r[key]!;
        valid += 1;
      }
    }
    return valid > 0 ? total : null;
  };

  return {
    source: "naver",
    rows: rows.slice(0, 20),
    latest: rows[0] ?? null,
    sum5d: { foreigner: sum("foreignerNet", 5), institution: sum("institutionNet", 5) },
    sum20d: { foreigner: sum("foreignerNet", 20), institution: sum("institutionNet", 20) },
    note: "Naver 증권 출처. '기관'에는 연기금·금융투자·보험·투신 등이 합산되어 있어 연기금만 분리되지 않습니다.",
  };
}
