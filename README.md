# DartLab

한국 주식 통합 분석 대시보드. DART 공시 · Yahoo Finance 시세 · Naver 증권 수급을 한 화면에 모아 보여줍니다.

가족이 함께 종목을 추적하는 용도로 만들어졌습니다 (참고: 부모님께 설명하기 좋은 정리 + 자동 갱신).

## 주요 기능

- **종목별 통합 뷰**: 종목 하나를 선택하면 재무제표 · 주가 차트 · 가치지표(PER/PBR/ROE/부채비율) · 공시 · 외국인·기관 수급을 한 페이지에서 확인
- **DART OpenAPI 자동 조회**: 종목명 또는 6자리 종목코드를 넣으면 회사 기본정보 · 재무제표(연 4년 + 분기 5개) · 최근 공시를 자동 수집
- **Yahoo Finance 연계**: 현재가 · 시가총액 → DART 순이익/자본총계로 PER · PBR 직접 계산
- **Naver 증권 수급**: 외국인 · 기관 일별 순매수 (최근 20거래일) + 주가 차트 PNG
- **자동 등급/점수 산정**: ROE · 부채비율 · 매출성장률 · 영업이익률 가중합산으로 A~D 등급
- **테마 관리**: 키워드 기반 자동 분류 (반도체/바이오/이차전지/...) + 수동 이동
- **사용자 메모**: 회사별 자유 메모 + 특이사항 추가 (localStorage 저장)

## 데이터 출처

| 카테고리 | 소스 | 비고 |
|---|---|---|
| 회사 기본정보 / 재무제표 / 공시 | [DART OpenAPI](https://opendart.fss.or.kr) | API 키 필요 |
| 시가총액 / 현재가 / 주가 차트 | Yahoo Finance · Naver 증권 | 키 불필요 |
| 외국인 · 기관 일별 매매 | Naver 증권 | 키 불필요. 연기금 단독은 분리 불가 (기관 합계만) |

## 설치 / 실행

```bash
npm install
cp .env.example .env.local
# .env.local에 DART OpenAPI 키를 넣어주세요 (https://opendart.fss.or.kr 에서 발급)
npm run dev
```

→ http://localhost:3000 접속

## 환경 변수

`.env.local`:

```
DART_API_KEY=발급받은_DART_OpenAPI_키
```

DART 키 없이도 폼 수동 입력은 동작하지만, "데이터 갱신" 자동 조회 기능은 키가 있어야 작동합니다. Yahoo와 Naver는 키 없이 동작합니다.

## Vercel 배포 (선택)

GitHub repo와 Vercel을 연결하면 push할 때마다 자동 배포됩니다.

1. https://vercel.com/new 접속 (GitHub 계정으로 로그인)
2. `Import Git Repository` → 이 저장소 선택
3. **Environment Variables**에 추가:
   - Key: `DART_API_KEY`
   - Value: 본인의 DART OpenAPI 인증키
4. **Deploy** 클릭

배포 후 발급되는 `*.vercel.app` 도메인에서 바로 사용 가능합니다.
다음부터는 `git push`만 하면 Vercel이 자동으로 빌드·배포합니다.

### 주의

- **Yahoo Finance · Naver 스크래핑**은 Vercel의 데이터센터 IP가 일부 차단될 수 있습니다 (로컬에선 OK라도). 그 경우 수급 데이터/PER·PBR 자동 계산이 안 될 수 있습니다.
- `/api/dart/fetch`는 DART 4건 + Yahoo 1건 + Naver 1건을 병렬 호출하느라 10초를 넘길 수 있어 `maxDuration=60`으로 설정돼 있습니다 (Hobby 플랜 한도).

## 기술 스택

- Next.js 16 (App Router, Turbopack)
- React 19
- TypeScript 5
- Tailwind CSS 4
- DART OpenAPI / Yahoo Finance / Naver 증권 (스크래핑)

## 한계

- **연기금 단독 분리 불가**: 무료 데이터 소스는 외국인 + 기관 합계만 제공
- **회사명 매칭 정확도**: DART의 fuzzy 매칭이 한자가 같은 다른 회사를 잡을 수 있음 (예: "현대" 키워드)
- **테마 자동 분류**: 키워드/업종코드 기반 휴리스틱이라 일부 종목은 미분류로 떨어짐 (수동 이동 가능)
- **TradingView 위젯 미사용**: KRX 라이선스 제약으로 차트 임베드 차단됨. 대신 Naver 차트 PNG 사용

## 데이터 저장

모든 사용자 데이터(추가 종목 · 테마 · 메모)는 브라우저 **localStorage**에만 저장됩니다. 서버 DB 없음. 브라우저 변경 시 데이터 이전이 필요합니다.

## 라이선스

개인/학습 용도. 데이터 출처(DART/Yahoo/Naver)의 이용 약관을 준수해서 사용해주세요.
