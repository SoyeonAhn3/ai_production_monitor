// Code Node 1: 데이터 검증
// 입력: Google Sheets에서 읽은 production_week + line_master (items로 전달)
// 출력: validRows + warnings + run_id

const input = items[0].json;
const productionRows = input.productionRows;
const lineMaster = input.lineMaster;
const run_id = input.run_id;

const NUMERIC_FIELDS = [
  '일일목표', '시간당생산', '시간당양품', '시간당불량', '시간당폐기', '시간당불량률(%)',
  '누적생산', '누적양품', '누적불량', '누적폐기', '누적불량률(%)',
  '달성률(%)', '예상달성률(%)', '달성갭(%p)',
  '시간당가동(분)', '시간당비가동(분)', '시간당가동률(%)', '누적가동률(%)'
];

const REQUIRED_COLUMNS = [
  '날짜', '시간', '라인ID', '라인명', '팀', '생산품목', '일일목표',
  '시간당생산', '시간당양품', '시간당불량', '시간당폐기', '시간당불량률(%)',
  '누적생산', '누적양품', '누적불량', '누적폐기', '누적불량률(%)',
  '달성률(%)', '예상달성률(%)', '달성갭(%p)',
  '시간당가동(분)', '시간당비가동(분)', '시간당가동률(%)', '누적가동률(%)',
  '이상플래그'
];

if (!productionRows || productionRows.length === 0) {
  return [{ json: { valid: false, error: '데이터가 비어 있습니다', validRows: [], warnings: [], run_id } }];
}

const firstRow = productionRows[0];
const missingCols = REQUIRED_COLUMNS.filter(col => !(col in firstRow));
if (missingCols.length > 0) {
  return [{ json: { valid: false, error: `필수 컬럼 누락: ${missingCols.join(', ')}`, validRows: [], warnings: [], run_id } }];
}

const lineMasterIds = new Set(lineMaster.map(lm => lm['라인ID']));
const validRows = [];
const warnings = [];

for (const row of productionRows) {
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
      type: 'null_fields', lineId, hour, fields: nullFields,
      message: `${lineId} ${hour}: 빈 필드 ${nullFields.length}개`
    });
    continue;
  }

  const parsed = { ...row };
  let typeError = false;
  for (const f of NUMERIC_FIELDS) {
    const num = parseFloat(parsed[f]);
    if (isNaN(num)) {
      warnings.push({ type: 'type_error', lineId, hour, field: f, message: `${lineId} ${hour}: ${f} 값이 숫자가 아님` });
      typeError = true;
      break;
    }
    parsed[f] = num;
  }

  if (!typeError) {
    validRows.push(parsed);
  }
}

const hours = [...new Set(validRows.map(r => r['시간']))].sort();
const currentHour = hours.length > 0 ? hours[hours.length - 1] : null;
const currentRows = currentHour ? validRows.filter(r => r['시간'] === currentHour) : [];

for (const lm of lineMaster) {
  if (currentHour && !currentRows.find(r => r['라인ID'] === lm['라인ID'])) {
    warnings.push({
      type: 'missing_line', lineId: lm['라인ID'], lineName: lm['라인명'], hour: currentHour,
      message: `${lm['라인명']}(${lm['라인ID']}): ${currentHour} 데이터 없음`
    });
  }
}

return [{ json: { valid: true, validRows, warnings, run_id, lineMaster } }];
