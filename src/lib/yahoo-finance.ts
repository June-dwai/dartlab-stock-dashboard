import "server-only";

const Y_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
const Y_BROWSER_HEADERS = {
  "User-Agent": Y_UA,
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://finance.yahoo.com",
  Referer: "https://finance.yahoo.com/",
} as const;
const CRUMB_TTL_MS = 60 * 60 * 1000;

type Crumb = { crumb: string; cookieHeader: string; expiresAt: number };

let crumbCache: Crumb | null = null;

function extractSetCookies(headers: Headers): string[] {
  const h = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === "function") {
    return h.getSetCookie();
  }
  const raw = headers.get("set-cookie");
  if (!raw) return [];
  return raw.split(/,\s*(?=[^=;]+=)/);
}

async function getCrumb(): Promise<Crumb | null> {
  if (crumbCache && Date.now() < crumbCache.expiresAt) return crumbCache;
  try {
    const seed = await fetch("https://fc.yahoo.com/", {
      headers: { ...Y_BROWSER_HEADERS, Accept: "text/html" },
      redirect: "follow",
      cache: "no-store",
    });
    const cookieParts = extractSetCookies(seed.headers)
      .map((c) => c.split(";")[0]?.trim())
      .filter((c): c is string => !!c);
    if (cookieParts.length === 0) return null;
    const cookieHeader = cookieParts.join("; ");

    const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: {
        ...Y_BROWSER_HEADERS,
        Cookie: cookieHeader,
        Accept: "text/plain",
      },
      cache: "no-store",
    });
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.length > 100 || crumb.includes("<")) return null;

    crumbCache = { crumb, cookieHeader, expiresAt: Date.now() + CRUMB_TTL_MS };
    return crumbCache;
  } catch {
    return null;
  }
}

export type YahooQuote = {
  symbol: string;
  price: number | null;
  currency: string | null;
  per: number | null;
  pbr: number | null;
  marketCap: number | null;
  asOf: string | null;
};

type YahooMoneyValue = { raw?: number } | undefined;
type YahooSummaryDetail = {
  trailingPE?: YahooMoneyValue;
  priceToBook?: YahooMoneyValue;
  regularMarketPrice?: YahooMoneyValue;
  marketCap?: YahooMoneyValue;
};
type YahooDefaultKeyStats = {
  trailingPE?: YahooMoneyValue;
  priceToBook?: YahooMoneyValue;
};
type YahooPriceModule = {
  regularMarketPrice?: YahooMoneyValue;
  regularMarketTime?: number;
  currency?: string;
  marketCap?: YahooMoneyValue;
};
type QuoteSummaryResponse = {
  quoteSummary?: {
    result?: Array<{
      summaryDetail?: YahooSummaryDetail;
      defaultKeyStatistics?: YahooDefaultKeyStats;
      price?: YahooPriceModule;
    }>;
    error?: unknown;
  };
};

function fmtAsOf(epochSec: number | undefined): string | null {
  if (!epochSec) return null;
  return new Date(epochSec * 1000).toISOString().slice(0, 10).replace(/-/g, ".");
}

async function tryQuoteSummary(symbol: string): Promise<YahooQuote | null> {
  const crumbData = await getCrumb();
  if (!crumbData) return null;
  const url = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}`);
  url.searchParams.set("modules", "summaryDetail,defaultKeyStatistics,price");
  url.searchParams.set("crumb", crumbData.crumb);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        ...Y_BROWSER_HEADERS,
        Cookie: crumbData.cookieHeader,
      },
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) crumbCache = null;
    return null;
  }
  const data = (await res.json()) as QuoteSummaryResponse;
  const result = data?.quoteSummary?.result?.[0];
  if (!result) return null;
  const sd = result.summaryDetail ?? {};
  const dks = result.defaultKeyStatistics ?? {};
  const pm = result.price ?? {};
  return {
    symbol,
    price: pm.regularMarketPrice?.raw ?? sd.regularMarketPrice?.raw ?? null,
    currency: pm.currency ?? "KRW",
    per: sd.trailingPE?.raw ?? dks.trailingPE?.raw ?? null,
    pbr: dks.priceToBook?.raw ?? sd.priceToBook?.raw ?? null,
    marketCap: pm.marketCap?.raw ?? sd.marketCap?.raw ?? null,
    asOf: fmtAsOf(pm.regularMarketTime),
  };
}

type ChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        regularMarketTime?: number;
        currency?: string;
      };
    }>;
  };
};

async function tryChart(symbol: string): Promise<YahooQuote | null> {
  try {
    const res = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}`, {
      headers: Y_BROWSER_HEADERS,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ChartResponse;
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    return {
      symbol,
      price: meta.regularMarketPrice ?? null,
      currency: meta.currency ?? "KRW",
      per: null,
      pbr: null,
      marketCap: null,
      asOf: fmtAsOf(meta.regularMarketTime),
    };
  } catch {
    return null;
  }
}

export async function fetchYahooQuote(
  stockCode: string,
  marketHint?: string,
): Promise<YahooQuote | null> {
  const padded = stockCode?.trim();
  if (!padded) return null;
  const code = padded.length < 6 ? padded.padStart(6, "0") : padded;
  const suffixes = marketHint === "KOSDAQ" ? [".KQ", ".KS"] : [".KS", ".KQ"];

  for (const suffix of suffixes) {
    const symbol = `${code}${suffix}`;
    const q = await tryQuoteSummary(symbol);
    if (q && (q.per !== null || q.pbr !== null || q.price !== null)) return q;
  }
  for (const suffix of suffixes) {
    const symbol = `${code}${suffix}`;
    const q = await tryChart(symbol);
    if (q && q.price !== null) return q;
  }
  return null;
}
