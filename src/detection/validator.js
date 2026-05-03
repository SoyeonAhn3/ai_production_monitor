const REQUIRED_COLUMNS = [
  '날짜', '시간', '라인ID', '라인명', '팀', '생산품목', '일일목표',
  '시간당생산', '시간당양품', '시간당불량', '시간당폐기', '시간당불량률(%)',
  '누적생산', '누적양품', '누적불량', '누적폐기', '누적불량률(%)',
  '달성률(%)', '예상달성률(%)', '달성갭(%p)',
  '시간당가동(분)', '시간당비가동(분)', '시간당가동률(%)', '누적가동률(%)',
  '이상플래그'
];

const NUMERIC_FIELDS = [
  '일일목표', '시간당생산', '시간당양품', '시간당불량', '시간당폐기', '시간당불량률(%)',
  '누적생산', '누적양품', '누적불량', '누적폐기', '누적불량률(%)',
  '달성률(%)', '예상달성률(%)', '달성갭(%p)',
  '시간당가동(분)', '시간당비가동(분)', '시간당가동률(%)', '누적가동률(%)'
];

function validateColumns(rows) {
  if (!rows || rows.length === 0) {
    return { valid: false, error: '데이터가 비어 있습니다', rows: [], warnings: [] };
  }

  const firstRow = rows[0];
  const missing = REQUIRED_COLUMNS.filter(col => !(col in firstRow));
  if (missing.length > 0) {
    return {
      valid: false,
      error: `필수 컬럼 누락: ${missing.join(', ')}`,
      rows: [],
      warnings: []
    };
  }

  return { valid: true, error: null, rows, warnings: [] };
}

function validateRows(rows, lineMaster) {
  const validRows = [];
  const warnings = [];
  const lineMasterIds = new Set(lineMaster.map(lm => lm['라인ID']));

  for (const row of rows) {
    const lineId = row['라인ID'];
    const hour = row['시간'];

    if (!lineId || lineId === '') {
      warnings.push({ type: 'missing_line_id', hour, message: '라인ID가 비어 있는 행 발견' });
      continue;
    }

    if (!lineMasterIds.has(lineId)) {
      warnings.push({ type: 'unknown_line', lineId, hour, message: `line_master에 없는 라인: ${lineId}` });
      continue;
    }

    const nullFields = NUMERIC_FIELDS.filter(f => {
      const val = row[f];
      return val === null || val === undefined || val === '';
    });

    if (nullFields.length > 0) {
      warnings.push({
        type: 'null_fields',
        lineId,
        hour,
        fields: nullFields,
        message: `${lineId} ${hour}: 빈 필드 ${nullFields.length}개 — ${nullFields.slice(0, 3).join(', ')}${nullFields.length > 3 ? ' ...' : ''}`
      });
      continue;
    }

    const parsed = { ...row };
    let typeError = false;
    for (const f of NUMERIC_FIELDS) {
      const num = parseFloat(parsed[f]);
      if (isNaN(num)) {
        warnings.push({
          type: 'type_error',
          lineId,
          hour,
          field: f,
          value: parsed[f],
          message: `${lineId} ${hour}: ${f} 값 "${parsed[f]}"이 숫자가 아님`
        });
        typeError = true;
        break;
      }
      parsed[f] = num;
    }

    if (!typeError) {
      validRows.push(parsed);
    }
  }

  return { validRows, warnings };
}

function checkLineCoverage(currentRows, lineMaster, currentHour) {
  const warnings = [];
  const presentLineIds = new Set(currentRows.map(r => r['라인ID']));

  for (const lm of lineMaster) {
    const lineId = lm['라인ID'];
    if (!presentLineIds.has(lineId)) {
      warnings.push({
        type: 'missing_line',
        lineId,
        lineName: lm['라인명'],
        hour: currentHour,
        message: `${lm['라인명']}(${lineId}): ${currentHour} 데이터 없음`
      });
    }
  }

  return warnings;
}

function validate(productionRows, lineMaster) {
  const colResult = validateColumns(productionRows);
  if (!colResult.valid) {
    return { valid: false, error: colResult.error, validRows: [], warnings: [] };
  }

  const { validRows, warnings: rowWarnings } = validateRows(productionRows, lineMaster);

  const hours = [...new Set(validRows.map(r => r['시간']))].sort();
  const currentHour = hours.length > 0 ? hours[hours.length - 1] : null;
  const currentRows = currentHour ? validRows.filter(r => r['시간'] === currentHour) : [];
  const coverageWarnings = currentHour ? checkLineCoverage(currentRows, lineMaster, currentHour) : [];

  return {
    valid: true,
    error: null,
    validRows,
    warnings: [...rowWarnings, ...coverageWarnings]
  };
}

module.exports = { validate, validateColumns, validateRows, checkLineCoverage, REQUIRED_COLUMNS };
