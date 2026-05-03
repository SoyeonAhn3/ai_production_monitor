// Code Node 3: 패턴 분류 + idempotency_key + 중복 알림 방지
// 입력: Code 2의 anomalies + Google Sheets에서 읽은 anomaly_log 이력
// 출력: 분류된 anomalies + notification 판정

const input = items[0].json;
const newAnomalies = input.anomalies;
const historicalLog = input.historicalLog || [];
const run_id = input.run_id;
const currentHour = input.currentHour;
const lineMaster = input.lineMaster;
const warnings = input.warnings || [];
const hourly_summary = input.hourly_summary;

if (!newAnomalies || newAnomalies.length === 0) {
  return [{ json: { classifiedAnomalies: [], run_id, currentHour, lineMaster, warnings, hourly_summary, hasSevere: false, hasMedium: false } }];
}

// --- idempotency_key 생성 + 중복 제거 ---
const existingKeys = new Set(historicalLog.filter(e => e.idempotency_key).map(e => e.idempotency_key));
const deduplicated = [];
for (const a of newAnomalies) {
  const key = `${a['라인ID']}_${a.rule_id}_${a['날짜']}_${a['시간']}`;
  a.idempotency_key = key;
  if (!existingKeys.has(key)) {
    deduplicated.push(a);
  }
}

// --- 패턴 분류 ---
const severityOrder = { '낮음': 0, '중간': 1, '심각': 2 };

const classified = deduplicated.map(anomaly => {
  const history = historicalLog.filter(h => h['라인ID'] === anomaly['라인ID'] && h['type'] === anomaly.type);
  const count = history.length;
  let patternType;

  if (count === 0) {
    patternType = '신규';
  } else if (count <= 2) {
    patternType = '반복';
    // 심각도 상승 추세 확인
    const sorted = [...history].sort((a, b) => `${a['날짜']} ${a['시간']}`.localeCompare(`${b['날짜']} ${b['시간']}`));
    if (sorted.length >= 2) {
      const levels = sorted.slice(-2).map(h => severityOrder[h.severity] || 0);
      const currentLevel = severityOrder[anomaly.severity] || 0;
      if (levels[1] > levels[0] || currentLevel > levels[1]) {
        patternType = '악화';
      }
    }
  } else {
    patternType = '악화';
  }

  let finalSeverity = anomaly.severity;
  const originalSeverity = anomaly.severity;
  if (patternType === '악화' && (anomaly.severity === '낮음' || anomaly.severity === '중간')) {
    finalSeverity = '심각';
  }

  return {
    ...anomaly,
    severity: finalSeverity,
    original_severity: originalSeverity,
    pattern_type: patternType,
    recurrence_count: count,
    run_id,
    notification_status: 'pending'
  };
});

// --- 중복 알림 방지 (Static Data) ---
const staticData = $getWorkflowStaticData('global');
const alertHistory = staticData.alertHistory || {};
const now = new Date().toISOString();

for (const a of classified) {
  const alertKey = `${a['라인ID']}_${a.type}`;
  const lastAlert = alertHistory[alertKey];

  if (a.severity === '심각') {
    if (lastAlert) {
      const elapsed = (new Date(now) - new Date(lastAlert)) / 1000 / 60;
      if (elapsed < 60) {
        a.notification_status = 'skipped';
      } else {
        alertHistory[alertKey] = now;
      }
    } else {
      alertHistory[alertKey] = now;
    }
  } else if (a.severity === '중간') {
    if (lastAlert) {
      const lastDate = lastAlert.slice(0, 13);
      const nowDate = now.slice(0, 13);
      if (lastDate === nowDate) {
        a.notification_status = 'skipped';
      } else {
        alertHistory[alertKey] = now;
      }
    } else {
      alertHistory[alertKey] = now;
    }
  } else {
    a.notification_status = 'skipped';
  }
}

staticData.alertHistory = alertHistory;

const toNotify = classified.filter(a => a.notification_status === 'pending');
const hasSevere = toNotify.some(a => a.severity === '심각' || a.pattern_type === '악화');
const hasMedium = toNotify.some(a => a.severity === '중간');

return [{ json: {
  classifiedAnomalies: classified,
  toNotify,
  run_id, currentHour, lineMaster, warnings, hourly_summary,
  hasSevere, hasMedium
} }];
