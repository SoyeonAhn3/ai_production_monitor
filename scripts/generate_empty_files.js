const XLSX = require('xlsx');
const path = require('path');

// ============================================================
// 1. production_week.xlsx (헤더만, 빈 파일)
// ============================================================
const weekHeaders = [
  '날짜', '시간', '라인ID', '라인명', '팀', '생산품목', '일일목표',
  '시간당생산', '시간당양품', '시간당불량', '시간당폐기', '시간당불량률(%)',
  '누적생산', '누적양품', '누적불량', '누적폐기', '누적불량률(%)',
  '달성률(%)', '예상달성률(%)', '달성갭(%p)',
  '시간당가동(분)', '시간당비가동(분)', '시간당가동률(%)', '누적가동률(%)',
  '이상플래그'
];

const weekWs = XLSX.utils.aoa_to_sheet([weekHeaders]);
const weekWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(weekWb, weekWs, 'production_week');

const weekPath = path.join(__dirname, '..', 'production', 'production_week.xlsx');
XLSX.writeFile(weekWb, weekPath);
console.log(`production_week.xlsx 생성 완료 (헤더만): ${weekPath}`);

// ============================================================
// 2. production_results.xlsx (4개 탭, 헤더만)
// ============================================================
const resultsWb = XLSX.utils.book_new();

// Tab 1: hourly_summary
const hourlySummaryHeaders = [
  '날짜', '시간', '팀', '작업건수', '계획합계', '실적합계', '달성률(%)',
  '불량합계', '폐기합계', '평균가동률(%)', '비가동합계(분)'
];
const hourlySummaryWs = XLSX.utils.aoa_to_sheet([hourlySummaryHeaders]);
XLSX.utils.book_append_sheet(resultsWb, hourlySummaryWs, 'hourly_summary');

// Tab 2: anomaly_log
const anomalyLogHeaders = [
  '날짜', '시간', '라인ID', '라인명', '팀', '품목',
  'type', 'severity', 'detail',
  'pattern_type', 'recurrence_count', 'ai_insight', 'ai_parsed'
];
const anomalyLogWs = XLSX.utils.aoa_to_sheet([anomalyLogHeaders]);
XLSX.utils.book_append_sheet(resultsWb, anomalyLogWs, 'anomaly_log');

// Tab 3: daily_summary
const dailySummaryHeaders = [
  '날짜', '팀', '총계획', '총실적', '일일달성률(%)',
  '총불량', '총폐기', '일일불량률(%)',
  '평균가동률(%)', '총비가동시간(분)',
  '이상건수_심각', '이상건수_중간', '이상건수_낮음',
  '반복이상건수', '악화이상건수'
];
const dailySummaryWs = XLSX.utils.aoa_to_sheet([dailySummaryHeaders]);
XLSX.utils.book_append_sheet(resultsWb, dailySummaryWs, 'daily_summary');

// Tab 4: error_log
const errorLogHeaders = [
  '날짜', '시간', 'workflow', 'step', 'error_type', 'error_message', 'action_taken'
];
const errorLogWs = XLSX.utils.aoa_to_sheet([errorLogHeaders]);
XLSX.utils.book_append_sheet(resultsWb, errorLogWs, 'error_log');

const resultsPath = path.join(__dirname, '..', 'production', 'production_results.xlsx');
XLSX.writeFile(resultsWb, resultsPath);
console.log(`production_results.xlsx 생성 완료 (4개 탭 헤더만): ${resultsPath}`);
console.log(`  - hourly_summary: ${hourlySummaryHeaders.length}개 컬럼`);
console.log(`  - anomaly_log: ${anomalyLogHeaders.length}개 컬럼`);
console.log(`  - daily_summary: ${dailySummaryHeaders.length}개 컬럼`);
console.log(`  - error_log: ${errorLogHeaders.length}개 컬럼`);
