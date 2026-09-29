// GoalPost BTC — shared data loading, formatting and page chrome.
// Every page includes this first; page scripts use the GP namespace.
(function () {
  'use strict';

  const DAY_MS = 86400000;

  // ── CSV ──
  // Small RFC-4180 parser: handles quoted fields, embedded commas/quotes and CRLF.
  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') inQuotes = false;
        else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(cell => cell.trim() !== ''));
  }

  async function fetchOK(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res;
  }

  let milestonesPromise;
  function loadMilestones() {
    milestonesPromise = milestonesPromise || fetchOK('data/milestones.csv')
      .then(r => r.text())
      .then(text => {
        const [header, ...rows] = parseCSV(text);
        const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
        return rows.map(r => ({
          date: r[idx.date].trim(),
          username: r[idx.username].trim(),
          btc: parseFloat(r[idx.btc]),
          screenshot: r[idx.screenshot].trim(),
        }))
          .filter(p => p.date && !Number.isNaN(p.btc))
          .sort((a, b) => a.date.localeCompare(b.date) || a.username.localeCompare(b.username));
      });
    return milestonesPromise;
  }

  let musingsPromise;
  function loadMusings() {
    musingsPromise = musingsPromise || fetchOK('data/musings.json')
      .then(r => r.json())
      .then(list => list.slice().sort((a, b) => b.date.localeCompare(a.date)));
    return musingsPromise;
  }

  // ── BTC daily closes ──
  // data/btc-daily.json is refreshed by tools/update_prices.py; days after it
  // are topped up from Kraken's public OHLC endpoint so charts stay current.
  let pricesPromise;
  function loadPrices() {
    pricesPromise = pricesPromise || (async () => {
      let closes = {};
      try {
        closes = (await (await fetchOK('data/btc-daily.json')).json()).closes;
      } catch (e) { console.warn('btc-daily.json unavailable', e); }
      const known = Object.keys(closes).sort();
      const last = known[known.length - 1];
      const yesterday = isoDay(Date.now() - DAY_MS);
      if (!last || last < yesterday) {
        try {
          const since = last ? Date.parse(last + 'T00:00:00Z') / 1000 : Date.now() / 1000 - 700 * 86400;
          const d = await (await fetchOK(`https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1440&since=${since}`)).json();
          const candles = d.result && (d.result.XXBTZUSD || Object.values(d.result).find(Array.isArray));
          for (const c of candles || []) {
            const day = isoDay(c[0] * 1000);
            if (!closes[day]) closes[day] = parseFloat(c[4]);
          }
        } catch (e) { console.warn('Kraken top-up failed', e); }
      }
      const dates = Object.keys(closes).sort();
      const values = dates.map(d => closes[d]);
      return {
        dates,
        values,
        // Close on the given day, or the nearest earlier day we have.
        on(iso) {
          if (closes[iso]) return closes[iso];
          let lo = 0, hi = dates.length - 1, found = -1;
          while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (dates[mid] <= iso) { found = mid; lo = mid + 1; } else hi = mid - 1;
          }
          return found >= 0 ? values[found] : null;
        },
      };
    })();
    return pricesPromise;
  }

  // ── Formatting ──
  function isoDay(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function dayNumber(iso) { return Date.parse(iso + 'T00:00:00Z') / DAY_MS; }

  function fmtBTC(x) {
    if (x == null || Number.isNaN(x)) return '—';
    return x.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 });
  }
  function fmtUSD(x, compact) {
    if (x == null || Number.isNaN(x)) return '—';
    if (compact && x >= 1000) {
      return '$' + x.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
    }
    return '$' + Math.round(x).toLocaleString('en-US');
  }
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLong = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function fmtDate(iso, long) {
    const [y, m, d] = iso.split('-').map(Number);
    return `${(long ? monthLong : monthNames)[m - 1]} ${d}, ${y}`;
  }
  function fmtMonth(iso) {
    const [y, m] = iso.split('-').map(Number);
    return `${monthLong[m - 1]} ${y}`;
  }

  function median(values) {
    if (!values.length) return null;
    const s = values.slice().sort((a, b) => a - b);
    const mid = s.length >> 1;
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Reddit handles get the u/ prefix; handles from other platforms keep their own (@…).
  function displayName(username) {
    return /^[@]/.test(username) ? username : 'u/' + username;
  }

  function screenshotURL(file) { return 'screenshots/' + encodeURIComponent(file); }
  function thumbURL(file) { return 'screenshots/thumbs/' + encodeURIComponent(file.replace(/\.[^.]+$/, '')) + '.jpg'; }
  function archiveURL(file) { return 'archive.html#' + encodeURIComponent(file); }

  // ── Page chrome ──
  async function initTicker() {
    const priceEl = document.getElementById('btc-price');
    const blockEl = document.getElementById('block-height');
    if (priceEl) {
      try {
        const d = await (await fetchOK('https://api.kraken.com/0/public/Ticker?pair=XBTUSD')).json();
        priceEl.textContent = fmtUSD(parseFloat(d.result.XXBTZUSD.c[0]));
      } catch (e) { priceEl.textContent = '—'; }
    }
    if (blockEl) {
      try {
        const h = await (await fetchOK('https://mempool.space/api/blocks/tip/height')).text();
        blockEl.textContent = parseInt(h, 10).toLocaleString('en-US');
      } catch (e) { blockEl.textContent = '—'; }
    }
  }

  // Fill any element with data-stat="…" from the dataset.
  async function fillStats() {
    const els = document.querySelectorAll('[data-stat]');
    if (!els.length) return;
    const posts = await loadMilestones();
    const first = posts[0].date, last = posts[posts.length - 1].date;
    const years = (dayNumber(last) - dayNumber(first)) / 365.25;
    const values = {
      posts: posts.length.toLocaleString('en-US'),
      users: new Set(posts.map(p => p.username.toLowerCase())).size.toLocaleString('en-US'),
      since: fmtMonth(first).replace(/^(\w{3})\w*/, '$1'),
      sinceLong: fmtMonth(first),
      latest: fmtDate(last),
      years: Math.floor(years).toString(),
      subOnePct: Math.round(100 * posts.filter(p => p.btc < 1).length / posts.length) + '%',
    };
    els.forEach(el => { if (values[el.dataset.stat] != null) el.textContent = values[el.dataset.stat]; });
  }

  function initReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('visible')); return; }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.1 });
    els.forEach(el => observer.observe(el));
  }

  // Lightweight screenshot viewer used by the charts (the archive page has its own).
  function openShot(file, caption) {
    let box = document.getElementById('shot-viewer');
    if (!box) {
      document.body.insertAdjacentHTML('beforeend', `
        <dialog class="lightbox" id="shot-viewer" aria-label="Screenshot viewer">
          <div class="lightbox-inner" style="grid-template-columns: 1fr">
            <figure><img alt=""><figcaption></figcaption></figure>
          </div>
          <button type="button" class="close-btn" aria-label="Close">✕</button>
        </dialog>`);
      box = document.getElementById('shot-viewer');
      box.querySelector('.close-btn').addEventListener('click', () => box.close());
      box.addEventListener('click', e => { if (e.target === box || e.target.classList.contains('lightbox-inner')) box.close(); });
    }
    const img = box.querySelector('img');
    img.src = screenshotURL(file);
    img.alt = 'Screenshot: ' + caption;
    box.querySelector('figcaption').innerHTML =
      `${escapeHTML(caption)} · <a href="${archiveURL(file)}">Open in archive →</a>`;
    if (!box.open) box.showModal();
  }

  function init() {
    initTicker();
    setInterval(initTicker, 60000);
    fillStats().catch(e => console.error(e));
    initReveal();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.GP = {
    loadMilestones, loadMusings, loadPrices,
    fmtBTC, fmtUSD, fmtDate, fmtMonth, median, escapeHTML, displayName,
    screenshotURL, thumbURL, archiveURL, dayNumber, isoDay, initReveal, openShot,
  };
})();
