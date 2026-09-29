// Data page: filters → stats strip, charts and sortable table.
(async function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const [all, prices] = await Promise.all([GP.loadMilestones(), GP.loadPrices()]);

  // Enrich every post once: price on the day, USD value, days since previous post.
  all.forEach((p, i) => {
    p.price = prices.on(p.date);
    p.usd = p.price ? p.btc * p.price : null;
    p.gap = i ? GP.dayNumber(p.date) - GP.dayNumber(all[i - 1].date) : null;
  });

  const first = all[0].date, last = all[all.length - 1].date;
  const inputs = { from: $('f-from'), to: $('f-to'), user: $('f-user'), outliers: $('f-outliers') };
  [inputs.from, inputs.to].forEach(el => { el.min = first; el.max = last; });

  function reset() {
    inputs.from.value = first;
    inputs.to.value = last;
    inputs.user.value = '';
    inputs.outliers.checked = true;
  }

  function filtered() {
    const from = inputs.from.value || first, to = inputs.to.value || last;
    const q = inputs.user.value.trim().toLowerCase();
    return all.filter(p =>
      p.date >= from && p.date <= to &&
      (!q || p.username.toLowerCase().includes(q)) &&
      (!inputs.outliers.checked || p.btc < 10));
  }

  // ── Charts ──
  const cards = [...document.querySelectorAll('[data-chart]')];
  cards.forEach(card => {
    const c = GP.charts[card.dataset.chart];
    card.innerHTML = `<h3>${c.title}</h3><p>${c.desc}</p><div class="chart" role="img" aria-label="${GP.escapeHTML(c.caption)}"></div>`;
  });

  // ── Stats ──
  function renderStats(posts) {
    const n = posts.length;
    $('s-posts').textContent = n.toLocaleString('en-US');
    const counts = new Map();
    posts.forEach(p => counts.set(p.username, (counts.get(p.username) || 0) + 1));
    $('s-users').textContent = counts.size.toLocaleString('en-US');
    $('s-median').textContent = n ? GP.fmtBTC(+GP.median(posts.map(p => p.btc)).toFixed(4)) : '—';
    const usd = posts.map(p => p.usd).filter(v => v != null);
    $('s-usd').textContent = usd.length ? GP.fmtUSD(GP.median(usd), true) : '—';
    const max = Math.max(0, ...counts.values());
    const leaders = [...counts].filter(([, c]) => c === max).map(([u]) => GP.displayName(u));
    $('s-top').textContent = max > 1 ? (leaders.length > 2 ? `${leaders.length}-way tie` : leaders.join(' & ')) : '—';
    $('s-top-n').textContent = max > 1 ? `${max} posts${leaders.length > 1 ? ' each' : ''}` : 'no repeat posters';
    $('s-span').textContent = n ? (GP.dayNumber(posts[n - 1].date) - GP.dayNumber(posts[0].date)).toLocaleString('en-US') : '—';
    $('result-count').textContent = `Showing ${n} of ${all.length} posts`;
  }

  // ── Table ──
  const table = $('table');
  const tbody = table.querySelector('tbody');
  let sortKey = 'date', sortDir = -1;

  function renderTable(posts) {
    const rows = posts.slice().sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = typeof va === 'string' ? va.localeCompare(vb, 'en', { sensitivity: 'base' }) : va - vb;
      return cmp * sortDir || b.date.localeCompare(a.date);
    });
    tbody.innerHTML = rows.map(p => `<tr>
      <td>${p.date}</td>
      <td>${GP.escapeHTML(GP.displayName(p.username))}</td>
      <td class="num btc">${GP.fmtBTC(p.btc)}</td>
      <td class="num">${GP.fmtUSD(p.usd)}</td>
      <td class="num">${GP.fmtUSD(p.price)}</td>
      <td class="num">${p.gap == null ? '—' : p.gap}</td>
      <td><a href="${GP.archiveURL(p.screenshot)}">View →</a></td>
    </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text-dim)">No posts match these filters.</td></tr>';
  }

  table.querySelectorAll('th[data-key] button').forEach(btn => {
    btn.addEventListener('click', () => {
      const th = btn.parentElement, key = th.dataset.key;
      sortDir = key === sortKey ? -sortDir : (key === 'username' ? 1 : -1);
      sortKey = key;
      table.querySelectorAll('th[data-key]').forEach(h => h.setAttribute('aria-sort', 'none'));
      th.setAttribute('aria-sort', sortDir === 1 ? 'ascending' : 'descending');
      renderTable(filtered());
    });
  });

  // ── Wire up ──
  function update() {
    const posts = filtered();
    renderStats(posts);
    cards.forEach(card => GP.charts[card.dataset.chart].render(card.querySelector('.chart'), posts, prices));
    renderTable(posts);
  }

  let timer;
  const debounced = () => { clearTimeout(timer); timer = setTimeout(update, 150); };
  Object.values(inputs).forEach(el => el.addEventListener(el.type === 'search' ? 'input' : 'change', debounced));
  $('f-reset').addEventListener('click', () => { reset(); update(); });

  reset();
  update();
})().catch(err => {
  console.error(err);
  document.querySelector('main').insertAdjacentHTML('afterbegin', '<p class="note">Could not load the dataset. Please refresh.</p>');
});
