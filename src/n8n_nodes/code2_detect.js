// Code Node 2: 이상 탐지 + hourly_summary 생성
// 입력: Code 1에서 전달된 validRows, lineMaster, run_id
// 출력: anomalies + hourly_summary

const input = items[0].json;
const productionRows = input.validRows;
const lineMaster = input.lineMaster;
const run_id = input.run_id;

const rules = [
  { id: "rule_01", name: "생산량 급감", type: "drop_rate", target: "시간당생산", compare_with: "previous_hour", levels: [{ severity: "심각", min: 40, max: null },{ severity: "중간", min: 20, max: 40 },{ severity: "낮음", min: 5, max: 20 }], message: "{line_name}: 생산량 {value}% 감소 (이전 {prev} → 현재 {curr})" },
  { id: "rule_02", name: "가동률 저하", type: "below_threshold", target: "시간당가동률(%)", levels: [{ severity: "심각", min: null, max: 30 },{ severity: "중간", min: 30, max: 50 },{ severity: "낮음", min: 50, max: 70 }], message: "{line_name}: 가동률 {value}% (기준 미달)" },
  { id: "rule_03", name: "불량률 급등", type: "exceeds_baseline", target: "시간당불량률(%)", baseline_field: "정상불량률", levels: [{ severity: "심각", min: 5, max: null },{ severity: "중간", min: 3, max: 5 },{ severity: "낮음", min: 2, max: 3 }], message: "{line_name}: 불량률 {value}% (정상의 {ratio}배, 기준 {baseline}%)" },
  { id: "rule_04", name: "달성률 지연", type: "below_threshold", target: "달성갭(%p)", levels: [{ severity: "심각", min: null, max: -30 },{ severity: "중간", min: -30, max: -15 },{ severity: "낮음", min: -15, max: -5 }], message: "{line_name}: 달성갭 {value}%p (예상 대비 지연)" },
  { id: "rule_05", name: "생산 정체", type: "consecutive_zero", target: "시간당생산", levels: [{ severity: "심각", min: 3, max: null },{ severity: "중간", min: 2, max: 3 },{ severity: "낮음", min: 1, max: 2 }], message: "{line_name}: 생산 {value}시간 연속 0 (설비 정지 의심)" },
  { id: "rule_06", name: "폐기 발생", type: "above_threshold", target: "시간당폐기", rate_base: "시간당생산", levels: [{ severity: "심각", min: 3, max: null },{ severity: "중간", min: 1, max: 3 },{ severity: "낮음", min: 0.1, max: 1 }], message: "{line_name}: 폐기율 {value}% ({scrap}개/{production}개)" },
  { id: "rule_07", name: "복합 이상", type: "compound", operator: "AND", conditions: [{ target: "시간당생산", compare_type: "drop_rate", compare_with: "previous_hour", levels: [{ severity: "심각", min: 30, max: null },{ severity: "중간", min: 15, max: 30 },{ severity: "낮음", min: 5, max: 15 }] },{ target: "시간당불량률(%)", compare_type: "exceeds_baseline", baseline_field: "정상불량률", levels: [{ severity: "심각", min: 3, max: null },{ severity: "중간", min: 2, max: 3 },{ severity: "낮음", min: 1.5, max: 2 }] }], message: "{line_name}: 복합 이상 — 생산 {drop}% 감소 + 불량 {ratio}배 증가" },
  { id: "rule_08", name: "가동률 급락", type: "drop_points", target: "시간당가동률(%)", compare_with: "previous_hour", levels: [{ severity: "심각", min: 50, max: null },{ severity: "중간", min: 30, max: 50 },{ severity: "낮음", min: 15, max: 30 }], message: "{line_name}: 가동률 {value}%p 급락 (이전 {prev}% → 현재 {curr}%)" }
];

// --- 유틸 함수 ---
function getLastTwoHours(rows) {
  const hours = [...new Set(rows.map(r => r['시간']))].sort();
  if (hours.length < 1) return { current: [], previous: [], currentHour: null, previousHour: null };
  const currentHour = hours[hours.length - 1];
  const previousHour = hours.length >= 2 ? hours[hours.length - 2] : null;
  return {
    current: rows.filter(r => r['시간'] === currentHour),
    previous: previousHour ? rows.filter(r => r['시간'] === previousHour) : [],
    currentHour, previousHour
  };
}

function getConsecutiveZeros(rows, lineId, targetField) {
  const lineRows = rows.filter(r => r['라인ID'] === lineId).sort((a, b) => a['시간'].localeCompare(b['시간']));
  let count = 0;
  for (let i = lineRows.length - 1; i >= 0; i--) {
    if (parseFloat(lineRows[i][targetField]) === 0) count++;
    else break;
  }
  return count;
}

function matchLevel(value, levels) {
  for (const level of levels) {
    const { min, max } = level;
    if (min === null && max === null) continue;
    if (min === null) { if (value < max) return level; }
    else if (max === null) { if (value >= min) return level; }
    else { if (value >= min && value < max) return level; }
  }
  return null;
}

function fmt(template, params) {
  let msg = template;
  for (const [key, val] of Object.entries(params)) { msg = msg.split(`{${key}}`).join(val); }
  return msg;
}

function evaluateRule(rule, row, prevRow, master, allRows, lineId) {
  if (rule.type === 'compound') {
    if (rule.operator !== 'AND') return null;
    const results = [];
    for (const cond of rule.conditions) {
      let val = null;
      if (cond.compare_type === 'drop_rate') {
        if (!prevRow) return null;
        const curr = parseFloat(row[cond.target]), prev = parseFloat(prevRow[cond.target]);
        if (isNaN(curr) || isNaN(prev) || prev === 0) return null;
        val = ((prev - curr) / prev) * 100;
        if (val <= 0) return null;
      } else if (cond.compare_type === 'exceeds_baseline') {
        const v = parseFloat(row[cond.target]), bl = parseFloat(master[cond.baseline_field]);
        if (isNaN(v) || isNaN(bl) || bl === 0) return null;
        val = v / bl;
      }
      if (val === null) return null;
      const level = matchLevel(val, cond.levels);
      if (!level) return null;
      results.push({ severity: level.severity, value: val });
    }
    if (results.length !== rule.conditions.length) return null;
    const sOrder = { '심각': 0, '중간': 1, '낮음': 2 };
    const worst = results.reduce((w, r) => sOrder[r.severity] < sOrder[w] ? r.severity : w, '낮음');
    return { severity: worst, message: fmt(rule.message, { line_name: row['라인명'], drop: results[0].value.toFixed(1), ratio: results[1].value.toFixed(1) }) };
  }

  if (rule.type === 'drop_rate') {
    if (!prevRow) return null;
    const curr = parseFloat(row[rule.target]), prev = parseFloat(prevRow[rule.target]);
    if (isNaN(curr) || isNaN(prev) || prev === 0) return null;
    const dropRate = ((prev - curr) / prev) * 100;
    if (dropRate <= 0) return null;
    const level = matchLevel(dropRate, rule.levels);
    if (!level) return null;
    return { severity: level.severity, message: fmt(rule.message, { line_name: row['라인명'], value: dropRate.toFixed(1), prev, curr }) };
  }

  if (rule.type === 'below_threshold') {
    const val = parseFloat(row[rule.target]);
    if (isNaN(val)) return null;
    const level = matchLevel(val, rule.levels);
    if (!level) return null;
    return { severity: level.severity, message: fmt(rule.message, { line_name: row['라인명'], value: val.toFixed(1) }) };
  }

  if (rule.type === 'exceeds_baseline') {
    const val = parseFloat(row[rule.target]), bl = parseFloat(master[rule.baseline_field]);
    if (isNaN(val) || isNaN(bl) || bl === 0) return null;
    const ratio = val / bl;
    const level = matchLevel(ratio, rule.levels);
    if (!level) return null;
    return { severity: level.severity, message: fmt(rule.message, { line_name: row['라인명'], value: val.toFixed(1), ratio: ratio.toFixed(1), baseline: bl.toFixed(1) }) };
  }

  if (rule.type === 'above_threshold') {
    const scrap = parseFloat(row[rule.target]), prod = parseFloat(row[rule.rate_base]);
    if (isNaN(scrap) || isNaN(prod) || prod === 0) return null;
    const rate = (scrap / prod) * 100;
    const level = matchLevel(rate, rule.levels);
    if (!level) return null;
    return { severity: level.severity, message: fmt(rule.message, { line_name: row['라인명'], value: rate.toFixed(1), scrap, production: prod }) };
  }

  if (rule.type === 'consecutive_zero') {
    const count = getConsecutiveZeros(allRows, lineId, rule.target);
    if (count === 0) return null;
    const level = matchLevel(count, rule.levels);
    if (!level) return null;
    return { severity: level.severity, message: fmt(rule.message, { line_name: row['라인명'], value: count }) };
  }

  if (rule.type === 'drop_points') {
    if (!prevRow) return null;
    const curr = parseFloat(row[rule.target]), prev = parseFloat(prevRow[rule.target]);
    if (isNaN(curr) || isNaN(prev)) return null;
    const drop = prev - curr;
    if (drop <= 0) return null;
    const level = matchLevel(drop, rule.levels);
    if (!level) return null;
    return { severity: level.severity, message: fmt(rule.message, { line_name: row['라인명'], value: drop.toFixed(1), prev: prev.toFixed(1), curr: curr.toFixed(1) }) };
  }

  return null;
}

// --- 메인 로직 ---
const { current, previous, currentHour, previousHour } = getLastTwoHours(productionRows);

if (current.length === 0) {
  return [{ json: { anomalies: [], hourly_summary: [], currentHour: null, run_id, lineMaster, warnings: input.warnings } }];
}

const lineMasterMap = {};
for (const lm of lineMaster) { lineMasterMap[lm['라인ID']] = lm; }

const anomalies = [];
for (const row of current) {
  const lineId = row['라인ID'];
  const master = lineMasterMap[lineId];
  if (!master) continue;
  const prevRow = previous.find(r => r['라인ID'] === lineId);

  for (const rule of rules) {
    try {
      const result = evaluateRule(rule, row, prevRow, master, productionRows, lineId);
      if (result) {
        anomalies.push({
          날짜: row['날짜'], 시간: currentHour, 라인ID: lineId, 라인명: row['라인명'],
          팀: row['팀'], 품목: row['생산품목'], type: rule.name, severity: result.severity,
          detail: result.message, rule_id: rule.id
        });
      }
    } catch (e) { /* 해당 룰 스킵 */ }
  }
}

// hourly_summary 생성
const teams = [...new Set(current.map(r => r['팀']))];
const date = current[0]?.['날짜'] || '';
const hourly_summary = teams.map(team => {
  const teamRows = current.filter(r => r['팀'] === team);
  const planTotal = teamRows.reduce((s, r) => s + (parseFloat(r['일일목표']) || 0), 0);
  const actualTotal = teamRows.reduce((s, r) => s + (parseFloat(r['시간당생산']) || 0), 0);
  const defectTotal = teamRows.reduce((s, r) => s + (parseFloat(r['시간당불량']) || 0), 0);
  const scrapTotal = teamRows.reduce((s, r) => s + (parseFloat(r['시간당폐기']) || 0), 0);
  const uptimeSum = teamRows.reduce((s, r) => s + (parseFloat(r['시간당가동(분)']) || 0), 0);
  const downtimeSum = teamRows.reduce((s, r) => s + (parseFloat(r['시간당비가동(분)']) || 0), 0);
  const avgUptime = teamRows.length > 0 ? (uptimeSum / (uptimeSum + downtimeSum)) * 100 : 0;
  const achieveRate = planTotal > 0 ? (actualTotal / planTotal) * 100 : 0;
  return {
    날짜: date, 시간: currentHour, 팀: team, 작업건수: teamRows.length, 계획합계: planTotal,
    실적합계: actualTotal, '달성률(%)': Math.round(achieveRate * 100) / 100, 불량합계: defectTotal,
    폐기합계: scrapTotal, '평균가동률(%)': Math.round(avgUptime * 100) / 100, '비가동합계(분)': downtimeSum
  };
});

return [{ json: { anomalies, hourly_summary, currentHour, run_id, lineMaster, warnings: input.warnings } }];
