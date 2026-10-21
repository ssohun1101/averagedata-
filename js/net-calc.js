/*
  2026년 연봉 실수령액 추정 계산기
  - 4대보험 요율: 국민연금 9.5%(근로자 4.75%, 기준소득월액 상한 659만원, 2026.7~),
    건강보험 7.19%(근로자 3.595%), 장기요양 = 건강보험료 x 13.14%, 고용보험 근로자 0.9%
  - 소득세: 근로소득공제 -> 인적공제/보험료공제 -> 기본세율(6~45%) -> 근로소득세액공제·자녀세액공제
    를 적용한 연 세액을 12로 나눈 추정치이며, 국세청 간이세액표와 일부 차이가 날 수 있습니다.
*/
const NET_CFG = {
  npRate: 0.0475,
  npCap: 6590000,
  hiRate: 0.03595,
  ltcRate: 0.1314,
  eiRate: 0.009,
  localTaxRate: 0.1,
  personalDeduction: 1500000
};

function floor10(n) { return Math.floor(n / 10) * 10; }

// 근로소득공제 (총급여 기준, 한도 2,000만원)
function workIncomeDeduction(g) {
  let d;
  if (g <= 5000000) d = g * 0.7;
  else if (g <= 15000000) d = 3500000 + (g - 5000000) * 0.4;
  else if (g <= 45000000) d = 7500000 + (g - 15000000) * 0.15;
  else if (g <= 100000000) d = 12000000 + (g - 45000000) * 0.05;
  else d = 14750000 + (g - 100000000) * 0.02;
  return Math.min(d, 20000000);
}

// 소득세 기본세율 (과세표준 기준, 누진공제 방식)
function incomeTaxByBase(b) {
  if (b <= 14000000) return b * 0.06;
  if (b <= 50000000) return b * 0.15 - 1260000;
  if (b <= 88000000) return b * 0.24 - 5760000;
  if (b <= 150000000) return b * 0.35 - 15440000;
  if (b <= 300000000) return b * 0.38 - 19940000;
  if (b <= 500000000) return b * 0.40 - 25940000;
  if (b <= 1000000000) return b * 0.42 - 35940000;
  return b * 0.45 - 65940000;
}

// 근로소득세액공제 (산출세액 기준 + 총급여별 한도)
function workTaxCredit(tax, g) {
  const credit = tax <= 1300000 ? tax * 0.55 : 715000 + (tax - 1300000) * 0.30;
  let limit;
  if (g <= 33000000) limit = 740000;
  else if (g <= 70000000) limit = Math.max(660000, 740000 - (g - 33000000) * 0.008);
  else if (g <= 120000000) limit = Math.max(500000, 660000 - (g - 70000000) * 0.5);
  else limit = Math.max(200000, 500000 - (g - 120000000) * 0.5);
  return Math.min(credit, limit);
}

// 자녀세액공제 (8세 이상 20세 이하 자녀 수 기준, 연)
function childCredit(n) {
  if (n <= 0) return 0;
  if (n === 1) return 250000;
  if (n === 2) return 550000;
  return 550000 + (n - 2) * 400000;
}

// annual: 세전 연봉(원), nonTaxMonthly: 월 비과세(원), household: 부양가족 수(본인 포함), children: 8~20세 자녀 수
function calcNet(opts) {
  const annual = opts.annual;
  const household = Math.max(1, opts.household || 1);
  const children = Math.min(Math.max(0, opts.children || 0), household - 1);
  const monthlyGross = annual / 12;
  const nonTax = Math.min(Math.max(0, opts.nonTaxMonthly || 0), monthlyGross);
  const base = monthlyGross - nonTax; // 보수월액(과세 월급)

  const np = floor10(Math.min(base, NET_CFG.npCap) * NET_CFG.npRate);
  const hi = floor10(base * NET_CFG.hiRate);
  const ltc = floor10(hi * NET_CFG.ltcRate);
  const ei = floor10(base * NET_CFG.eiRate);
  const insuranceYear = (np + hi + ltc + ei) * 12;

  const g = base * 12; // 과세 총급여(연)
  const earnDed = workIncomeDeduction(g);
  const personal = NET_CFG.personalDeduction * household;
  const taxBase = Math.max(0, g - earnDed - personal - insuranceYear);
  const calcTax = incomeTaxByBase(taxBase);
  const credits = workTaxCredit(calcTax, g) + childCredit(children);
  const finalTax = Math.max(0, calcTax - credits);

  const incomeTax = floor10(finalTax / 12);
  const localTax = floor10(incomeTax * NET_CFG.localTaxRate);
  const totalDeduction = np + hi + ltc + ei + incomeTax + localTax;
  const net = Math.round(monthlyGross - totalDeduction);

  return {
    monthlyGross: Math.round(monthlyGross),
    nonTax: Math.round(nonTax),
    base: Math.round(base),
    np, hi, ltc, ei, incomeTax, localTax,
    totalDeduction,
    net,
    netYear: net * 12,
    deductionRate: totalDeduction / monthlyGross,
    taxBase: Math.round(taxBase)
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calcNet, NET_CFG };
}
