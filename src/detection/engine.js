const fs = require('fs');
const path = require('path');

function loadRules(rulesPath) {
  const raw = fs.readFileSync(rulesPath, 'utf8');
  return JSON.parse(raw).rules;
}

function getLastTwoHours(rows) {
  const hours = [...new Set(rows.map(r => r['시간']))].sort();
  if (hours.length < 1) return { current: [], previous: [], currentHour: null, previousHour: null };
  const currentHour = hours[hours.length - 1];
  const previousHour = hours.length >= 2 ? hours[hours.length - 2] : null;
  const current = rows.filter(r => r['시간'] === currentHour);
  const previous = previousHour ? rows.filter(r => r['시간'] === previousHour) : [];
  return { current, previous, currentHour, previousHour };
}

function getConsecutiveZeros(rows, lineId, targetField) {
  const lineRows = rows
    .filter(r => r['라인ID'] === lineId)
    .sort((a, b) => a['시간'].localeCompare(b['시간']));

  let count = 0;
  for (let i = lineRows.length - 1; i >= 0; i--) {
    const val = parseFloat(lineRows[i][targetField]);
    if (val === 0) count++;
    else break;
  }
  return count;
}

function evaluateDropRate(curr, prev) {
  if (prev === 0) return null;
  return ((prev - curr) / prev) * 100;
}

function evaluateDropPoints(curr, prev) {
  return prev - curr;
}

function matchLevel(value, levels) {
  for (const level of levels) {
    const min = level.min;
    const max = level.max;
    if (min === null && max === null) continue;
    if (min === null) {
      if (value < max) return level;
    } else if (max === null) {
      if (value >= min) return level;
    } else {
      if (value >= min && value < max) return level;
    }
  }
  return null;
}

function formatMessage(template, params) {
  let msg = template;
  for (const [key, val] of Object.entries(params)) {
    msg = msg.replace(`{${key}}`, val);
  }
  return msg;
}

function detectAnomalies(rules, productionRows, lineMaster) {
  const { current, previous, currentHour, previousHour } = getLastTwoHours(productionRows);
  if (current.length === 0) return { anomalies: [], hourly_summary: [], currentHour };

  const lineMasterMap = {};
  for (const lm of lineMaster) {
    lineMasterMap[lm['라인ID']] = lm;
  }

  const anomalies = [];

  for (const row of current) {
    const lineId = row['라인ID'];
    const lineName = row['라인명'];
    const team = row['팀'];
    const product = row['생산품목'];
    const master = lineMasterMap[lineId];
    if (!master) continue;

    const prevRow = previous.find(r => r['라인ID'] === lineId);

    for (const rule of rules) {
      try {
        const result = evaluateRule(rule, row, prevRow, master, productionRows, lineId);
        if (result) {
          anomalies.push({
            날짜: row['날짜'],
            시간: currentHour,
            라인ID: lineId,
            라인명: lineName,
            팀: team,
            품목: product,
            type: rule.name,
            severity: result.severity,
            detail: result.message,
            rule_id: rule.id
          });
        }
      } catch (e) {
        // 해당 룰만 스킵, 나머지 룰 계속
      }
    }
  }

  const hourly_summary = buildHourlySummary(current, lineMaster, currentHour);

  return { anomalies, hourly_summary, currentHour };
}

function evaluateRule(rule, row, prevRow, master, allRows, lineId) {
  if (rule.type === 'compound') {
    return evaluateCompound(rule, row, prevRow, master, allRows, lineId);
  }

  if (rule.type === 'drop_rate') {
    if (!prevRow) return null;
    const curr = parseFloat(row[rule.target]);
    const prev = parseFloat(prevRow[rule.target]);
    if (isNaN(curr) || isNaN(prev)) return null;
    const dropRate = evaluateDropRate(curr, prev);
    if (dropRate === null || dropRate <= 0) return null;
    const level = matchLevel(dropRate, rule.levels);
    if (!level) return null;
    return {
      severity: level.severity,
      message: formatMessage(rule.message, {
        line_name: row['라인명'], value: dropRate.toFixed(1),
        prev: prev, curr: curr
      })
    };
  }

  if (rule.type === 'below_threshold') {
    const val = parseFloat(row[rule.target]);
    if (isNaN(val)) return null;
    const level = matchLevel(val, rule.levels);
    if (!level) return null;
    return {
      severity: level.severity,
      message: formatMessage(rule.message, {
        line_name: row['라인명'], value: val.toFixed(1)
      })
    };
  }

  if (rule.type === 'exceeds_baseline') {
    const val = parseFloat(row[rule.target]);
    const baseline = parseFloat(master[rule.baseline_field]);
    if (isNaN(val) || isNaN(baseline) || baseline === 0) return null;
    const ratio = val / baseline;
    const level = matchLevel(ratio, rule.levels);
    if (!level) return null;
    return {
      severity: level.severity,
      message: formatMessage(rule.message, {
        line_name: row['라인명'], value: val.toFixed(1),
        ratio: ratio.toFixed(1), baseline: baseline.toFixed(1)
      })
    };
  }

  if (rule.type === 'above_threshold') {
    const scrap = parseFloat(row[rule.target]);
    const production = parseFloat(row[rule.rate_base]);
    if (isNaN(scrap) || isNaN(production) || production === 0) return null;
    const rate = (scrap / production) * 100;
    const level = matchLevel(rate, rule.levels);
    if (!level) return null;
    return {
      severity: level.severity,
      message: formatMessage(rule.message, {
        line_name: row['라인명'], value: rate.toFixed(1),
        scrap: scrap, production: production
      })
    };
  }

  if (rule.type === 'consecutive_zero') {
    const count = getConsecutiveZeros(allRows, lineId, rule.target);
    if (count === 0) return null;
    const level = matchLevel(count, rule.levels);
    if (!level) return null;
    return {
      severity: level.severity,
      message: formatMessage(rule.message, {
        line_name: row['라인명'], value: count
      })
    };
  }

  if (rule.type === 'drop_points') {
    if (!prevRow) return null;
    const curr = parseFloat(row[rule.target]);
    const prev = parseFloat(prevRow[rule.target]);
    if (isNaN(curr) || isNaN(prev)) return null;
    const drop = evaluateDropPoints(curr, prev);
    if (drop <= 0) return null;
    const level = matchLevel(drop, rule.levels);
    if (!level) return null;
    return {
      severity: level.severity,
      message: formatMessage(rule.message, {
        line_name: row['라인명'], value: drop.toFixed(1),
        prev: prev.toFixed(1), curr: curr.toFixed(1)
      })
    };
  }

  return null;
}

function evaluateCompound(rule, row, prevRow, master, allRows, lineId) {
  if (rule.operator !== 'AND') return null;

  const results = [];
  for (const cond of rule.conditions) {
    const subRule = { ...cond, type: cond.compare_type, message: '' };
    const fakeRule = subRule;

    let val = null;
    if (cond.compare_type === 'drop_rate') {
      if (!prevRow) return null;
      const curr = parseFloat(row[cond.target]);
      const prev = parseFloat(prevRow[cond.target]);
      if (isNaN(curr) || isNaN(prev)) return null;
      val = evaluateDropRate(curr, prev);
      if (val === null || val <= 0) return null;
    } else if (cond.compare_type === 'exceeds_baseline') {
      const v = parseFloat(row[cond.target]);
      const baseline = parseFloat(master[cond.baseline_field]);
      if (isNaN(v) || isNaN(baseline) || baseline === 0) return null;
      val = v / baseline;
    }

    if (val === null) return null;
    const level = matchLevel(val, cond.levels);
    if (!level) return null;
    results.push({ severity: level.severity, value: val });
  }

  if (results.length !== rule.conditions.length) return null;

  const severityOrder = { '심각': 0, '중간': 1, '낮음': 2 };
  const worstSeverity = results.reduce((worst, r) =>
    severityOrder[r.severity] < severityOrder[worst] ? r.severity : worst
  , '낮음');

  return {
    severity: worstSeverity,
    message: formatMessage(rule.message, {
      line_name: row['라인명'],
      drop: results[0].value.toFixed(1),
      ratio: results[1].value.toFixed(1)
    })
  };
}

function buildHourlySummary(currentRows, lineMaster, currentHour) {
  const teams = [...new Set(currentRows.map(r => r['팀']))];
  const date = currentRows[0]?.['날짜'] || '';

  return teams.map(team => {
    const teamRows = currentRows.filter(r => r['팀'] === team);
    const planTotal = teamRows.reduce((s, r) => s + (parseFloat(r['일일목표']) || 0), 0);
    const actualTotal = teamRows.reduce((s, r) => s + (parseFloat(r['시간당생산']) || 0), 0);
    const defectTotal = teamRows.reduce((s, r) => s + (parseFloat(r['시간당불량']) || 0), 0);
    const scrapTotal = teamRows.reduce((s, r) => s + (parseFloat(r['시간당폐기']) || 0), 0);
    const uptimeSum = teamRows.reduce((s, r) => s + (parseFloat(r['시간당가동(분)']) || 0), 0);
    const downtimeSum = teamRows.reduce((s, r) => s + (parseFloat(r['시간당비가동(분)']) || 0), 0);
    const avgUptime = teamRows.length > 0 ? (uptimeSum / (uptimeSum + downtimeSum)) * 100 : 0;
    const achieveRate = planTotal > 0 ? (actualTotal / planTotal) * 100 : 0;

    return {
      날짜: date,
      시간: currentHour,
      팀: team,
      작업건수: teamRows.length,
      계획합계: planTotal,
      실적합계: actualTotal,
      '달성률(%)': Math.round(achieveRate * 100) / 100,
      불량합계: defectTotal,
      폐기합계: scrapTotal,
      '평균가동률(%)': Math.round(avgUptime * 100) / 100,
      '비가동합계(분)': downtimeSum
    };
  });
}

module.exports = { loadRules, detectAnomalies, getLastTwoHours, matchLevel };
