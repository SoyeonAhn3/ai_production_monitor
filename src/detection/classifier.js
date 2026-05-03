function classifyPatterns(newAnomalies, historicalLog) {
  return newAnomalies.map(anomaly => {
    const history = historicalLog.filter(h =>
      h['라인ID'] === anomaly['라인ID'] &&
      h['type'] === anomaly.type
    );

    const count = history.length;
    let patternType;

    if (count === 0) {
      patternType = '신규';
    } else if (count <= 2) {
      patternType = '반복';
    } else {
      patternType = '악화';
    }

    if (patternType === '반복' && count >= 1) {
      const hasSeverityEscalation = checkSeverityEscalation(history, anomaly);
      if (hasSeverityEscalation) {
        patternType = '악화';
      }
    }

    let finalSeverity = anomaly.severity;
    if (patternType === '악화' && (anomaly.severity === '낮음' || anomaly.severity === '중간')) {
      finalSeverity = '심각';
    }

    return {
      ...anomaly,
      severity: finalSeverity,
      original_severity: anomaly.severity,
      pattern_type: patternType,
      recurrence_count: count
    };
  });
}

function checkSeverityEscalation(history, current) {
  const severityOrder = { '낮음': 0, '중간': 1, '심각': 2 };
  const currentLevel = severityOrder[current.severity] ?? 0;

  const sorted = [...history].sort((a, b) => {
    const dateA = `${a['날짜']} ${a['시간']}`;
    const dateB = `${b['날짜']} ${b['시간']}`;
    return dateA.localeCompare(dateB);
  });

  if (sorted.length >= 2) {
    const recent = sorted.slice(-2);
    const levels = recent.map(h => severityOrder[h.severity] ?? 0);
    if (levels[1] > levels[0] || currentLevel > levels[1]) {
      return true;
    }
  }

  return false;
}

function filterByDateRange(anomalyLog, days) {
  if (!anomalyLog || anomalyLog.length === 0) return [];

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return anomalyLog.filter(entry => entry['날짜'] >= cutoffStr);
}

function generateIdempotencyKey(anomaly) {
  return `${anomaly['라인ID']}_${anomaly.rule_id}_${anomaly['날짜']}_${anomaly['시간']}`;
}

function deduplicateAnomalies(anomalies, existingLog) {
  const existingKeys = new Set(
    existingLog
      .filter(e => e.idempotency_key)
      .map(e => e.idempotency_key)
  );

  return anomalies.filter(a => {
    const key = generateIdempotencyKey(a);
    a.idempotency_key = key;
    return !existingKeys.has(key);
  });
}

module.exports = { classifyPatterns, filterByDateRange, generateIdempotencyKey, deduplicateAnomalies };
