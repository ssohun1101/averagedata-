/*
  연령대별 평균 연봉 백분위 계산기
  데이터 출처: 통계청 「임금근로일자리 소득(보수) 결과」(2024년 12월 기준, 2026년 2월 발표)
  방법론: 각 연령대의 평균소득을 기준으로 로그정규분포를 가정하여 백분위를 추정합니다.
  (실제 소득 분포의 왜도를 반영한 근사치이며, 정확한 개인별 순위가 아닌 참고용 추정입니다.)
  자세한 방법론은 methodology.html 참고.
*/

// 연령대별 연 평균소득 (단위: 만원) — 월평균소득 × 12
const AGE_BRACKETS = {
  "20s": { label: "20대", min: 20, max: 29, annualMean: 3252 },
  "30s": { label: "30대", min: 30, max: 39, annualMean: 4764 },
  "40s": { label: "40대", min: 40, max: 49, annualMean: 5628 },
  "50s": { label: "50대", min: 50, max: 59, annualMean: 5340 },
  "60s": { label: "60대", min: 60, max: 69, annualMean: 3516 },
  "70s": { label: "70세 이상", min: 70, max: 120, annualMean: 1980 }
};

// 로그정규분포 표준편차(로그공간) 근사값 — methodology.html 설명 참고
const SIGMA = 0.65;

function getBracketByAge(age) {
  if (age < 20) return AGE_BRACKETS["20s"];
  if (age <= 29) return AGE_BRACKETS["20s"];
  if (age <= 39) return AGE_BRACKETS["30s"];
  if (age <= 49) return AGE_BRACKETS["40s"];
  if (age <= 59) return AGE_BRACKETS["50s"];
  if (age <= 69) return AGE_BRACKETS["60s"];
  return AGE_BRACKETS["70s"];
}

// 표준정규분포 CDF (erf 근사, Abramowitz & Stegun 7.1.26)
function erf(x) {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1=0.254829592, a2=-0.284496736, a3=1.421413741, a4=-1.453152027, a5=1.061405429, p=0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-x*x);
  return sign * y;
}
function normCDF(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

// income: 만원 단위 연봉, bracket: AGE_BRACKETS 값
function computePercentile(incomeManwon, bracket) {
  const mean = bracket.annualMean;
  const mu = Math.log(mean) - (SIGMA * SIGMA) / 2;
  const z = (Math.log(incomeManwon) - mu) / SIGMA;
  const belowPct = normCDF(z) * 100; // 나보다 적게 버는 사람 비율
  const topPct = 100 - belowPct;     // 상위 몇 %
  return { belowPct, topPct, z, mean };
}

// SVG 정규분포 곡선(로그소득 축 기준) + 사용자 위치 마커
function renderCurve(container, z) {
  const w = 560, h = 200, padX = 20, padY = 20;
  const curveW = w - padX * 2, curveH = h - padY * 2 - 24;

  // z를 -3~3 범위로 클램프해 x좌표 매핑
  const zClamped = Math.max(-3, Math.min(3, z));
  const xForZ = (zz) => padX + ((zz + 3) / 6) * curveW;
  const gaussian = (zz) => Math.exp(-(zz * zz) / 2);

  let path = "";
  const steps = 80;
  for (let i = 0; i <= steps; i++) {
    const zz = -3 + (6 * i) / steps;
    const x = xForZ(zz);
    const y = padY + curveH - gaussian(zz) * curveH;
    path += (i === 0 ? "M" : "L") + x.toFixed(2) + "," + y.toFixed(2) + " ";
  }
  const baseY = padY + curveH;
  const markerX = xForZ(zClamped);
  const markerY = padY + curveH - gaussian(zClamped) * curveH;

  // 마커 왼쪽 영역(나보다 적게 버는 분포) 채우기
  let fillPath = "M" + xForZ(-3) + "," + baseY + " ";
  for (let i = 0; i <= steps; i++) {
    const zz = -3 + (6 * i) / steps;
    if (zz > zClamped) break;
    const x = xForZ(zz);
    const y = padY + curveH - gaussian(zz) * curveH;
    fillPath += "L" + x.toFixed(2) + "," + y.toFixed(2) + " ";
  }
  fillPath += "L" + markerX.toFixed(2) + "," + baseY + " Z";

  container.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="연령대 소득 분포 곡선과 내 위치">
      <path d="${fillPath}" fill="#C89B3C" fill-opacity="0.18" stroke="none"></path>
      <path d="${path.trim()}" fill="none" stroke="#14213D" stroke-width="1.6"></path>
      <line x1="${padX}" y1="${baseY}" x2="${w - padX}" y2="${baseY}" stroke="#DDD5C7" stroke-width="1"></line>
      <line x1="${markerX.toFixed(2)}" y1="${padY - 4}" x2="${markerX.toFixed(2)}" y2="${baseY}" stroke="#8F6C24" stroke-width="1.4" stroke-dasharray="3,3"></line>
      <circle cx="${markerX.toFixed(2)}" cy="${markerY.toFixed(2)}" r="5" fill="#8F6C24"></circle>
      <text x="${markerX.toFixed(2)}" y="${h - 4}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#8F6C24">나</text>
      <text x="${padX}" y="${h - 4}" text-anchor="start" font-family="Noto Sans KR, sans-serif" font-size="11" fill="#5B6472">소득 낮음</text>
      <text x="${w - padX}" y="${h - 4}" text-anchor="end" font-family="Noto Sans KR, sans-serif" font-size="11" fill="#5B6472">소득 높음</text>
    </svg>
  `;
}

function formatManwon(n) {
  return Math.round(n).toLocaleString("ko-KR");
}

function initCalculator() {
  const form = document.getElementById("calc-form");
  if (!form) return;
  const result = document.getElementById("result");
  const curveEl = document.getElementById("curve");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const age = parseInt(document.getElementById("age").value, 10);
    const salary = parseFloat(document.getElementById("salary").value);
    if (!age || !salary || age < 15 || age > 100 || salary <= 0) return;

    const bracket = getBracketByAge(age);
    const { belowPct, topPct, z, mean } = computePercentile(salary, bracket);

    const headline = document.getElementById("result-headline");
    const sub = document.getElementById("result-sub");

    let topPctDisplay = topPct < 1 ? "1" : topPct.toFixed(0);
    let position;
    if (topPct <= 50) {
      position = `${bracket.label} 상위 <span class="pct">${topPctDisplay}%</span>`;
    } else {
      position = `${bracket.label} 하위 <span class="pct">${(100 - topPct).toFixed(0)}%</span>`;
    }

    headline.innerHTML = position;
    sub.textContent = `${bracket.label} 평균 연봉은 약 ${formatManwon(mean)}만 원이며, 입력하신 ${formatManwon(salary)}만 원은 이 평균과 비교했을 때의 위치입니다.`;

    renderCurve(curveEl, z);
    result.classList.add("show");
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

document.addEventListener("DOMContentLoaded", initCalculator);
