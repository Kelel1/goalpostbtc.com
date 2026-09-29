// Homepage: daily rotation of a post, a musing and a live chart.
// Seeded shuffle: the year sets the order, the day of year picks the entry,
// so the whole list is shown before anything repeats within a year.
(function () {
  'use strict';

  function seededRandom(seed) {
    const x = Math.sin(seed + 1) * 10000;
    return x - Math.floor(x);
  }

  function shuffleWithSeed(arr, seed) {
    const a = [...arr.keys()];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom(seed + i) * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function getDayOfYear() {
    const now = new Date();
    return Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  }

  // First couple of sentences, for musings without a hand-written preview.
  function autoPreview(text) {
    const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
    let out = '';
    for (const s of sentences) {
      if (out && (out + s).length > 260) break;
      out += s;
    }
    return out.trim() + (out.trim().length < text.trim().length ? '…' : '');
  }

  const $ = id => document.getElementById(id);
  const year = new Date().getFullYear();
  const day = getDayOfYear();
  const pick = (arr, salt) => arr[shuffleWithSeed(arr, year * salt)[day % arr.length]];

  GP.loadMilestones().then(posts => {
    const p = pick(posts, 1000);
    $('post-date').textContent = GP.fmtMonth(p.date);
    $('post-amount').textContent = GP.fmtBTC(p.btc) + ' BTC';
    $('post-username').textContent = GP.displayName(p.username);
    $('post-link').href = GP.archiveURL(p.screenshot);
    $('post-screenshot-wrap').innerHTML =
      `<a href="${GP.archiveURL(p.screenshot)}"><img src="${GP.thumbURL(p.screenshot)}" alt="Screenshot of ${GP.escapeHTML(GP.displayName(p.username))}'s milestone post" class="daily-screenshot"></a>`;
  });

  GP.loadMusings().then(musings => {
    const m = pick(musings, 2000);
    $('musing-date').textContent = GP.fmtDate(m.date, true);
    $('musing-title').textContent = m.title;
    $('musing-preview').textContent = m.preview || autoPreview(m.paragraphs[0]);
    $('musing-link').href = 'musings.html#' + m.slug;
  });

  // The Goalpost Movement: median milestone per calendar year, straight from the data.
  GP.loadMilestones().then(posts => {
    const years = new Map();
    posts.forEach(p => { const y = p.date.slice(0, 4); (years.get(y) || years.set(y, []).get(y)).push(p.btc); });
    const rows = [...years].map(([year, amounts]) => {
      const counts = new Map();
      amounts.forEach(a => counts.set(a, (counts.get(a) || 0) + 1));
      const [top, topN] = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
      return { year, n: amounts.length, median: GP.median(amounts), top, topN, subOne: amounts.filter(a => a < 1).length };
    });
    const max = Math.max(...rows.map(r => r.median));
    const current = String(new Date().getFullYear());
    $('timeline').innerHTML = rows.map(r => `
      <div class="timeline-year">
        <div class="timeline-year-label">${r.year}${r.year === current ? ' · so far' : ''}</div>
        <div class="timeline-amount">${GP.fmtBTC(+r.median.toFixed(2))} BTC</div>
        <div class="timeline-desc">${r.n} posts · ${Math.round(100 * r.subOne / r.n)}% under 1 BTC${r.topN > 1 ? ` · most common: ${GP.fmtBTC(r.top)} BTC (${r.topN})` : ''}</div>
        <div class="timeline-bar" style="width: ${Math.max(2, 100 * r.median / max)}%;"></div>
      </div>`).join('');
  });

  const keys = Object.keys(GP.charts);
  const chart = GP.charts[pick(keys, 3000)];
  $('chart-name').textContent = chart.title;
  $('chart-desc').textContent = chart.desc;
  $('chart-caption').textContent = chart.caption;
  Promise.all([GP.loadMilestones(), GP.loadPrices()]).then(([posts, prices]) => {
    chart.render($('chart-live'), posts.filter(p => p.btc < 10), prices);
  });
})();
