import { NextRequest, NextResponse } from "next/server";

import { fetchNaverInvestor } from "@/lib/naver-investor";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await ctx.params;
  if (!ticker || !/^\d+$/.test(ticker)) {
    return NextResponse.json(
      { error: "유효한 종목코드(숫자)가 필요합니다." },
      { status: 400 },
    );
  }
  try {
    const data = await fetchNaverInvestor(ticker);
    if (!data) {
      return NextResponse.json(
        { error: "Naver 증권에서 수급 데이터를 가져오지 못했습니다." },
        { status: 404 },
      );
    }
    return NextResponse.json({
      ...data,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `수급 조회 오류: ${String(err)}` },
      { status: 500 },
    );
  }
}
