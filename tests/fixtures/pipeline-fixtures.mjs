export const FIXED_NOW = '2026-06-08T03:00:00.000Z';
export const EMPTY_CWA = "var TY_DataTime = '202606080000'; var TYPHOON = {};";
export const EMPTY_DGPA = '<html><title>停止上班及上課情形查詢</title><table id="Table"><tr><th>縣市名稱</th><th>是否停止上班上課情形</th></tr><tr><td colspan="2">無停班停課訊息。</td></tr><tr><td colspan="3">機關尚無停止上班之適用。</td></tr></table></html>';

export function makeCwaFeed(storms = [{ key: 'ALPHA', chineseName: '甲颱', lat: 21, lon: 128 }]) {
  const names = Object.fromEntries(storms.map((storm) => [storm.key, { Name: { C: storm.chineseName, E: storm.key } }]));
  const points = (storm, offset) => {
    const date = new Date(Date.parse('2026-06-08T08:00:00Z') + offset * 3600000);
    const display = `${date.getUTCMonth() + 1}月${date.getUTCDate()}日${String(date.getUTCHours()).padStart(2, '0')}時`;
    if (offset > 0 && storm.terminationAt !== undefined && offset >= storm.terminationAt) {
      return `<li>預測 ${display}</li><li>預測 ${offset} 小時內變性為溫帶氣旋</li>`;
    }
    return `<li>${offset === 0 ? '過去移動方向 西北</li><li>過去移動時速 20公里' : `西北 時速 20 公里</li><li>預測 ${display}`}</li>
      <li>中心位置在北緯 ${storm.lat + offset / 48} 度，東經 ${storm.lon - offset / 48} 度</li>
      <li>中心氣壓 960百帕</li><li>近中心最大風速每秒 38 公尺</li><li>瞬間最大陣風每秒 48 公尺</li>
      <li>七級風${offset === 0 ? '平均' : ''}暴風半徑 250 公里</li>
      ${storm.omitRadius10 ? '' : `<li>十級風${offset === 0 ? '平均' : ''}暴風半徑 80 公里</li>`}
      ${offset === 0 ? '' : `<li>70%機率半徑 ${offset * 2} 公里</li>`}`;
  };
  const panels = storms.map((storm, index) => `<div class="panel panel-default"><div class="panel-heading"><h4><span class="fa-red">中度颱風</span><span class="fa-blue">${storm.chineseName}</span><br>編號第 ${index + 1} 號<br>國際命名 ${storm.key}</h4></div><div class="panel-body"><div class="typ-path"><span class="now">現況</span><p>2026年6月8日08時</p><ul>${points(storm, 0)}</ul></div><div class="typ-path"><span class="prediction">預測</span>${(storm.forecastOffsets ?? [6, 48, 72, 96]).map((offset) => `<p>預測 ${offset} 小時平均移向移速為</p><ul>${points(storm, offset)}</ul>`).join('')}</div></div></div>`).join('');
  // The real feed consists of concatenated quoted HTML fragments, not JSON or executable data.
  const expression = panels.split('\n').map((line) => JSON.stringify(line)).join('+\n');
  return `var TY_DataTime = '202606080000';\nvar TYPHOON = ${JSON.stringify(names)};\nvar TY_LIST_2 = new Array();\nTY_LIST_2['C'] = ${expression};\n`;
}

export function makeFetch({ cwa = makeCwaFeed(), dgpa = EMPTY_DGPA, geminiText, geminiFailure = false, cwaFailure = false, dgpaFailure = false, onRequest } = {}) {
  return async (url, options) => {
    onRequest?.(url, options);
    if (url.includes('TY_NEWS-Data.js')) {
      if (cwaFailure) throw new Error('CWA unavailable');
      return new Response(cwa);
    }
    if (url.includes('dgpa.gov.tw')) {
      if (dgpaFailure) throw new Error('DGPA unavailable');
      return new Response(dgpa);
    }
    if (url.includes('generativelanguage.googleapis.com')) {
      if (geminiFailure) throw new Error('Gemini unavailable');
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: geminiText }] } }] }));
    }
    throw new Error(`Unexpected offline test request: ${url}`);
  };
}
