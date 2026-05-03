const path = require('path');
const { loadRules, detectAnomalies } = require('../src/detection/engine');
const { validate } = require('../src/detection/validator');
const { classifyPatterns, filterByDateRange, deduplicateAnomalies } = require('../src/detection/classifier');
const { buildMaskDict, applyMask, applyUnmask, maskAnomalies } = require('../src/detection/masker');

const lineMaster = [
  { 라인ID: 'L01', 라인명: '프레스 1호기', 팀: '1팀', 상위라인ID: '', 계층: 'line', 품목: '패널 A',     시간당목표: 120, 정상불량률: 0.8 },
  { 라인ID: 'L02', 라인명: '프레스 2호기', 팀: '1팀', 상위라인ID: '', 계층: 'line', 품목: '패널 B',     시간당목표: 100, 정상불량률: 1.0 },
  { 라인ID: 'L03', 라인명: 'CNC 1호기',    팀: '1팀', 상위라인ID: '', 계층: 'line', 품목: '샤프트 A',   시간당목표: 80,  정상불량률: 0.5 },
  { 라인ID: 'L04', 라인명: 'CNC 2호기',    팀: '1팀', 상위라인ID: '', 계층: 'line', 품목: '샤프트 B',   시간당목표: 75,  정상불량률: 0.6 },
  { 라인ID: 'L05', 라인명: '용접 1호기',   팀: '2팀', 상위라인ID: '', 계층: 'line', 품목: '프레임 A',   시간당목표: 60,  정상불량률: 1.2 },
  { 라인ID: 'L06', 라인명: '용접 2호기',   팀: '2팀', 상위라인ID: '', 계층: 'line', 품목: '프레임 B',   시간당목표: 55,  정상불량률: 1.5 },
  { 라인ID: 'L07', 라인명: '도장 라인',    팀: '2팀', 상위라인ID: '', 계층: 'line', 품목: '도장 부품',  시간당목표: 90,  정상불량률: 2.0 },
  { 라인ID: 'L08', 라인명: '사출 1호기',   팀: '2팀', 상위라인ID: '', 계층: 'line', 품목: '케이스 A',   시간당목표: 150, 정상불량률: 0.7 },
  { 라인ID: 'L09', 라인명: '사출 2호기',   팀: '3팀', 상위라인ID: '', 계층: 'line', 품목: '케이스 B',   시간당목표: 140, 정상불량률: 0.8 },
  { 라인ID: 'L10', 라인명: '조립 1라인',   팀: '3팀', 상위라인ID: '', 계층: 'line', 품목: '완제품 A',   시간당목표: 45,  정상불량률: 0.3 },
  { 라인ID: 'L11', 라인명: '조립 2라인',   팀: '3팀', 상위라인ID: '', 계층: 'line', 품목: '완제품 B',   시간당목표: 40,  정상불량률: 0.4 },
  { 라인ID: 'L12', 라인명: '검사/포장',    팀: '3팀', 상위라인ID: '', 계층: 'line', 품목: '출하 검사',  시간당목표: 200, 정상불량률: 0.2 },
];

function makeRow(lineId, hour, overrides = {}) {
  const lm = lineMaster.find(l => l.라인ID === lineId);
  const target = lm.시간당목표;
  const defectRate = lm.정상불량률;
  const prod = overrides.시간당생산 ?? Math.floor(target * 0.95);
  const defect = overrides.시간당불량 ?? Math.round(prod * defectRate / 100);
  const scrap = overrides.시간당폐기 ?? 0;
  const good = Math.max(0, prod - defect - scrap);
  const uptime = overrides['시간당가동(분)'] ?? 55;
  const downtime = 60 - uptime;
  const uptimeRate = (uptime / 60) * 100;

  return {
    날짜: '2026-03-23',
    시간: hour,
    라인ID: lineId,
    라인명: lm.라인명,
    팀: lm.팀,
    생산품목: lm.품목,
    일일목표: target * 10,
    시간당생산: prod,
    시간당양품: good,
    시간당불량: defect,
    시간당폐기: scrap,
    '시간당불량률(%)': prod > 0 ? Math.round((defect / prod) * 10000) / 100 : 0,
    누적생산: prod,
    누적양품: good,
    누적불량: defect,
    누적폐기: scrap,
    '누적불량률(%)': prod > 0 ? Math.round((defect / prod) * 10000) / 100 : 0,
    '달성률(%)': overrides['달성률(%)'] ?? Math.round((prod / (target * 10)) * 10000) / 100,
    '예상달성률(%)': 10,
    '달성갭(%p)': overrides['달성갭(%p)'] ?? 0,
    '시간당가동(분)': uptime,
    '시간당비가동(분)': downtime,
    '시간당가동률(%)': Math.round(uptimeRate * 100) / 100,
    '누적가동률(%)': Math.round(uptimeRate * 100) / 100,
    이상플래그: overrides.이상플래그 ?? ''
  };
}

function makeNormalHour(hour) {
  return lineMaster.map(lm => makeRow(lm.라인ID, hour));
}

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.log(`  [FAIL] ${testName}`);
    failed++;
  }
}

// ============================================================
console.log('\n=== TEST 1: rules.json 로드 ===');
const rulesPath = path.join(__dirname, '..', 'config', 'rules.json');
const rules = loadRules(rulesPath);
assert(rules.length === 8, `룰 8개 로드됨 (실제: ${rules.length})`);
assert(rules[0].id === 'rule_01', `첫 번째 룰 ID: rule_01`);
assert(rules[6].type === 'compound', `룰 7은 compound 타입`);

// ============================================================
console.log('\n=== TEST 2: 데이터 검증 (validator) ===');
const normalRows = [...makeNormalHour('10:00'), ...makeNormalHour('11:00')];
const validResult = validate(normalRows, lineMaster);
assert(validResult.valid === true, '정상 데이터 검증 통과');
assert(validResult.validRows.length === 24, `정상 행 24개 (실제: ${validResult.validRows.length})`);

const badRows = [...normalRows, { 라인ID: '', 시간: '11:00' }];
const badResult = validate(badRows, lineMaster);
assert(badResult.warnings.length > 0, `빈 라인ID 경고 발생 (경고 ${badResult.warnings.length}개)`);

const nullRow = makeRow('L01', '11:00', {});
nullRow['시간당생산'] = '';
const nullRows = [...makeNormalHour('10:00'), nullRow];
const nullResult = validate(nullRows, lineMaster);
assert(nullResult.warnings.some(w => w.type === 'null_fields'), 'null 필드 경고 감지');

// ============================================================
console.log('\n=== TEST 3: 시나리오 1 — CNC 1호기 설비 고장 (생산량 급감) ===');
const scenario1Rows = [
  ...makeNormalHour('10:00'),
  ...lineMaster.map(lm => {
    if (lm.라인ID === 'L03') {
      return makeRow('L03', '11:00', { 시간당생산: 5, 시간당불량: 2, '시간당가동(분)': 15 });
    }
    return makeRow(lm.라인ID, '11:00');
  })
];

const s1Result = detectAnomalies(rules, scenario1Rows, lineMaster);
const s1CNC = s1Result.anomalies.filter(a => a['라인ID'] === 'L03');
assert(s1CNC.length > 0, `CNC 1호기 이상 감지됨 (${s1CNC.length}건)`);

const s1Production = s1CNC.find(a => a.type === '생산량 급감');
assert(s1Production != null, '생산량 급감 룰 탐지');
assert(s1Production?.severity === '심각', `심각도: ${s1Production?.severity}`);

const s1Uptime = s1CNC.find(a => a.type === '가동률 저하');
assert(s1Uptime != null, '가동률 저하 탐지');

// ============================================================
console.log('\n=== TEST 4: 시나리오 2 — 도장 라인 불량률 급등 ===');
const scenario2Rows = [
  ...makeNormalHour('09:00'),
  ...lineMaster.map(lm => {
    if (lm.라인ID === 'L07') {
      return makeRow('L07', '10:00', { 시간당불량: Math.round(85 * 2.0 * 8 / 100) });
    }
    return makeRow(lm.라인ID, '10:00');
  })
];

const s2Result = detectAnomalies(rules, scenario2Rows, lineMaster);
const s2Paint = s2Result.anomalies.filter(a => a['라인ID'] === 'L07');
const s2Defect = s2Paint.find(a => a.type === '불량률 급등');
assert(s2Defect != null, '도장 라인 불량률 급등 탐지');
assert(s2Defect?.severity === '심각', `심각도: ${s2Defect?.severity}`);

// ============================================================
console.log('\n=== TEST 5: 시나리오 3 — 사출 1호기 금형 이상 (생산 급감) ===');
const scenario3Rows = [
  ...makeNormalHour('12:00'),
  ...lineMaster.map(lm => {
    if (lm.라인ID === 'L08') {
      return makeRow('L08', '13:00', { 시간당생산: 50, 시간당불량: 8, 시간당폐기: 3, '시간당가동(분)': 35 });
    }
    return makeRow(lm.라인ID, '13:00');
  })
];

const s3Result = detectAnomalies(rules, scenario3Rows, lineMaster);
const s3Injection = s3Result.anomalies.filter(a => a['라인ID'] === 'L08');
assert(s3Injection.length > 0, `사출 1호기 이상 감지됨 (${s3Injection.length}건)`);
const s3Prod = s3Injection.find(a => a.type === '생산량 급감');
assert(s3Prod != null, '생산량 급감 탐지');

// ============================================================
console.log('\n=== TEST 6: 시나리오 4 — 조립 2라인 복합 이상 (생산↓ + 불량↑) ===');
const scenario4Rows = [
  ...makeNormalHour('09:00'),
  ...lineMaster.map(lm => {
    if (lm.라인ID === 'L11') {
      return makeRow('L11', '10:00', { 시간당생산: 20, 시간당불량: Math.round(20 * 0.4 * 5 / 100) });
    }
    return makeRow(lm.라인ID, '10:00');
  })
];

const s4Result = detectAnomalies(rules, scenario4Rows, lineMaster);
const s4Assembly = s4Result.anomalies.filter(a => a['라인ID'] === 'L11');
assert(s4Assembly.length > 0, `조립 2라인 이상 감지됨 (${s4Assembly.length}건)`);

// ============================================================
console.log('\n=== TEST 7: 시나리오 5 — 프레스 1호기 가동률 급락 ===');
const scenario5Rows = [
  ...makeNormalHour('14:00'),
  ...lineMaster.map(lm => {
    if (lm.라인ID === 'L01') {
      return makeRow('L01', '15:00', { 시간당생산: 20, '시간당가동(분)': 10 });
    }
    return makeRow(lm.라인ID, '15:00');
  })
];

const s5Result = detectAnomalies(rules, scenario5Rows, lineMaster);
const s5Press = s5Result.anomalies.filter(a => a['라인ID'] === 'L01');
const s5UptimeDrop = s5Press.find(a => a.type === '가동률 급락');
assert(s5UptimeDrop != null, '가동률 급락 탐지');
assert(s5UptimeDrop?.severity === '심각', `심각도: ${s5UptimeDrop?.severity}`);

// ============================================================
console.log('\n=== TEST 8: 생산 정체 (연속 0) ===');
const zeroRows = [
  ...lineMaster.map(lm => makeRow(lm.라인ID, '10:00')),
  ...lineMaster.map(lm => {
    if (lm.라인ID === 'L03') return makeRow('L03', '11:00', { 시간당생산: 0, '시간당가동(분)': 0 });
    return makeRow(lm.라인ID, '11:00');
  }),
  ...lineMaster.map(lm => {
    if (lm.라인ID === 'L03') return makeRow('L03', '12:00', { 시간당생산: 0, '시간당가동(분)': 0 });
    return makeRow(lm.라인ID, '12:00');
  }),
  ...lineMaster.map(lm => {
    if (lm.라인ID === 'L03') return makeRow('L03', '13:00', { 시간당생산: 0, '시간당가동(분)': 0 });
    return makeRow(lm.라인ID, '13:00');
  })
];

const zeroResult = detectAnomalies(rules, zeroRows, lineMaster);
const zeroAnomaly = zeroResult.anomalies.find(a => a['라인ID'] === 'L03' && a.type === '생산 정체');
assert(zeroAnomaly != null, 'CNC 1호기 3시간 연속 0 탐지');
assert(zeroAnomaly?.severity === '심각', `심각도: ${zeroAnomaly?.severity}`);

// ============================================================
console.log('\n=== TEST 9: 패턴 분류 (classifier) ===');
const testAnomalies = [
  { 라인ID: 'L03', type: '생산량 급감', severity: '심각', rule_id: 'rule_01', 날짜: '2026-03-23', 시간: '11:00', 라인명: 'CNC 1호기', 팀: '1팀', 품목: '샤프트 A', detail: 'test' },
  { 라인ID: 'L07', type: '불량률 급등', severity: '낮음', rule_id: 'rule_03', 날짜: '2026-03-23', 시간: '10:00', 라인명: '도장 라인', 팀: '2팀', 품목: '도장 부품', detail: 'test' }
];

const emptyHistory = [];
const classified1 = classifyPatterns(testAnomalies, emptyHistory);
assert(classified1[0].pattern_type === '신규', `이력 0건 → 신규 (실제: ${classified1[0].pattern_type})`);

const historyWith3 = [
  { 라인ID: 'L07', type: '불량률 급등', severity: '낮음', 날짜: '2026-03-20', 시간: '09:00' },
  { 라인ID: 'L07', type: '불량률 급등', severity: '낮음', 날짜: '2026-03-21', 시간: '09:00' },
  { 라인ID: 'L07', type: '불량률 급등', severity: '중간', 날짜: '2026-03-22', 시간: '09:00' }
];
const classified2 = classifyPatterns(testAnomalies, historyWith3);
const paintClassified = classified2.find(c => c['라인ID'] === 'L07');
assert(paintClassified?.pattern_type === '악화', `이력 3건 → 악화 (실제: ${paintClassified?.pattern_type})`);
assert(paintClassified?.severity === '심각', `악화 + 낮음 → 심각으로 에스컬레이션 (실제: ${paintClassified?.severity})`);

// ============================================================
console.log('\n=== TEST 10: idempotency_key 중복 방지 ===');
const anomaliesWithKeys = testAnomalies.map(a => ({ ...a }));
const existingLog = [{ idempotency_key: 'L03_rule_01_2026-03-23_11:00' }];
const deduped = deduplicateAnomalies(anomaliesWithKeys, existingLog);
assert(deduped.length === 1, `중복 제거: 2건 → 1건 (실제: ${deduped.length})`);
assert(deduped[0]['라인ID'] === 'L07', `남은 건: L07 (실제: ${deduped[0]['라인ID']})`);

// ============================================================
console.log('\n=== TEST 11: 마스킹/언마스킹 ===');
const { maskDict, reverseDict } = buildMaskDict(lineMaster);
assert(maskDict['CNC 1호기'] != null, `CNC 1호기 마스킹 코드 존재: ${maskDict['CNC 1호기']}`);
assert(maskDict['샤프트 A'] != null, `샤프트 A 마스킹 코드 존재: ${maskDict['샤프트 A']}`);

const original = 'CNC 1호기에서 샤프트 A 불량률이 급등했습니다';
const masked = applyMask(original, maskDict);
assert(!masked.includes('CNC 1호기'), `마스킹 후 원본 이름 없음`);
assert(masked.includes('LINE_'), `마스킹 코드 포함`);

const unmasked = applyUnmask(masked, reverseDict);
assert(unmasked.includes('CNC 1호기'), `언마스킹 후 원본 이름 복원`);
assert(unmasked === original, `원본과 동일`);

// ============================================================
console.log('\n=== TEST 12: hourly_summary 생성 ===');
const summaryResult = detectAnomalies(rules, normalRows, lineMaster);
assert(summaryResult.hourly_summary.length === 3, `3개 팀 summary (실제: ${summaryResult.hourly_summary.length})`);
const team1 = summaryResult.hourly_summary.find(s => s.팀 === '1팀');
assert(team1 != null, '1팀 summary 존재');
assert(team1?.작업건수 === 4, `1팀 작업건수 4 (실제: ${team1?.작업건수})`);

// ============================================================
console.log('\n=== TEST 13: 첫 시간 (비교 대상 없음) ===');
const firstHourOnly = makeNormalHour('08:00');
const firstResult = detectAnomalies(rules, firstHourOnly, lineMaster);
const dropAnomalies = firstResult.anomalies.filter(a => a.type === '생산량 급감' || a.type === '가동률 급락');
assert(dropAnomalies.length === 0, `첫 시간: 비교 룰 이상 0건 (실제: ${dropAnomalies.length})`);

// ============================================================
console.log('\n========================================');
console.log(`총 결과: ${passed} PASS / ${failed} FAIL`);
console.log('========================================');

if (failed > 0) {
  process.exit(1);
}
