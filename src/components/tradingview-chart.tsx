"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";

type Range = "day" | "month3" | "year" | "year3" | "year10";

const RANGES: Array<{ key: Range; label: string }> = [
  { key: "day", label: "1일" },
  { key: "month3", label: "3개월" },
  { key: "year", label: "1년" },
  { key: "year3", label: "3년" },
  { key: "year10", label: "10년" },
];

// Naver Finance serves static chart PNGs that work without embed restrictions.
// Url shape: https://ssl.pstatic.net/imgfinance/chart/item/area/<range>/<6-digit-ticker>.png
export function TradingViewMiniChart({ ticker }: { ticker: string }) {
  const [range, setRange] = useState<Range>("year");
  const [errored, setErrored] = useState(false);
  const [version, setVersion] = useState(0);

  if (!ticker || !/^\d+$/.test(ticker)) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 bg-white px-4 py-6 text-center text-xs text-zinc-500">
        차트는 숫자 종목코드가 있을 때만 표시됩니다.
      </div>
    );
  }

  const padded = ticker.length < 6 ? ticker.padStart(6, "0") : ticker;
  const cacheBuster = version === 0 ? "" : `?v=${version}`;
  const url = `https://ssl.pstatic.net/imgfinance/chart/item/area/${range}/${padded}.png${cacheBuster}`;
  const naverPage = `https://finance.naver.com/item/main.naver?code=${padded}`;

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
          주가 차트
          <span className="font-mono text-xs font-medium text-zinc-500">{padded}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 rounded-md bg-zinc-100 p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => {
                  setRange(r.key);
                  setErrored(false);
                }}
                className={`rounded px-2 py-1 text-[11px] font-semibold transition ${
                  r.key === range
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setVersion((v) => v + 1);
              setErrored(false);
            }}
            className="inline-flex items-center rounded-md border border-zinc-200 bg-white p-1 text-zinc-600 hover:bg-zinc-50"
            title="차트 다시 불러오기"
            aria-label="차트 다시 불러오기"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          <a
            href={naverPage}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-semibold text-emerald-700 hover:underline"
          >
            Naver 증권 →
          </a>
        </div>
      </div>
      <div className="flex items-center justify-center bg-white px-4 py-3">
        {errored ? (
          <div className="py-12 text-sm text-zinc-500">
            차트를 불러오지 못했습니다. Naver 증권 링크에서 확인해주세요.
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={url}
            alt={`${padded} ${range} 차트`}
            className="max-w-full"
            onError={() => setErrored(true)}
          />
        )}
      </div>
    </div>
  );
}
