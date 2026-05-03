function buildMaskDict(lineMaster) {
  const maskDict = {};
  const reverseDict = {};

  lineMaster.forEach((lm, i) => {
    const lineCode = `LINE_${String.fromCharCode(65 + i)}`;
    const productCode = `PROD_${String(i + 1).padStart(2, '0')}`;
    const teamCode = `TEAM_${lm['팀'].replace(/[^0-9]/g, '')}`;

    maskDict[lm['라인명']] = lineCode;
    maskDict[lm['품목']] = productCode;
    maskDict[lm['팀']] = teamCode;

    reverseDict[lineCode] = lm['라인명'];
    reverseDict[productCode] = lm['품목'];
    reverseDict[teamCode] = lm['팀'];
  });

  return { maskDict, reverseDict };
}

function applyMask(text, maskDict) {
  let masked = text;
  const sortedKeys = Object.keys(maskDict).sort((a, b) => b.length - a.length);
  for (const original of sortedKeys) {
    masked = masked.split(original).join(maskDict[original]);
  }
  return masked;
}

function applyUnmask(text, reverseDict) {
  let unmasked = text;
  const sortedKeys = Object.keys(reverseDict).sort((a, b) => b.length - a.length);
  for (const code of sortedKeys) {
    unmasked = unmasked.split(code).join(reverseDict[code]);
  }
  return unmasked;
}

function maskAnomalies(anomalies, maskDict) {
  return anomalies.map(a => ({
    ...a,
    라인명: maskDict[a['라인명']] || a['라인명'],
    품목: maskDict[a['품목']] || a['품목'],
    팀: maskDict[a['팀']] || a['팀'],
    detail: applyMask(a.detail, maskDict)
  }));
}

module.exports = { buildMaskDict, applyMask, applyUnmask, maskAnomalies };
