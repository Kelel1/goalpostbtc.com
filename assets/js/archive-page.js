// Archive page: filterable screenshot grid with a lightbox and deep links
// (archive.html#<screenshot file name> opens that screenshot).
(async function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const posts = await GP.loadMilestones();
  const gallery = $('gallery'), search = $('a-search'), amount = $('a-amount'), sort = $('a-sort');
  const box = $('lightbox'), boxImg = box.querySelector('img'), boxCap = box.querySelector('figcaption');
  let visible = [], current = -1;

  const inBucket = {
    '': () => true,
    'lt0.01': b => b < 0.01,
    '0.01-0.1': b => b >= 0.01 && b < 0.1,
    '0.1-1': b => b >= 0.1 && b < 1,
    '1+': b => b >= 1,
  };
  const order = {
    new: (a, b) => b.date.localeCompare(a.date),
    old: (a, b) => a.date.localeCompare(b.date),
    big: (a, b) => b.btc - a.btc,
    small: (a, b) => a.btc - b.btc,
  };

  function caption(p) {
    return `<span class="amount">${GP.fmtBTC(p.btc)} BTC</span> · ${GP.escapeHTML(GP.displayName(p.username))} · ${GP.fmtDate(p.date)}`;
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    visible = posts
      .filter(p => (!q || p.username.toLowerCase().includes(q)) && inBucket[amount.value](p.btc))
      .sort(order[sort.value]);
    const ids = new Set();  // one screenshot can hold two milestones (a post and a comment)
    gallery.innerHTML = visible.map((p, i) => `
      <figure class="shot"${ids.has(p.screenshot) ? '' : ` id="${GP.escapeHTML(ids.add(p.screenshot) && p.screenshot)}"`}>
        <button type="button" data-i="${i}" aria-label="Open screenshot: ${GP.escapeHTML(GP.displayName(p.username))}, ${GP.fmtBTC(p.btc)} BTC">
          <img src="${GP.thumbURL(p.screenshot)}" alt="" loading="lazy" decoding="async" width="480" height="600">
        </button>
        <figcaption>
          <div class="amount">${GP.fmtBTC(p.btc)} BTC</div>
          <div class="who">${GP.escapeHTML(GP.displayName(p.username))}</div>
          <div class="when">${GP.fmtDate(p.date)}</div>
        </figcaption>
      </figure>`).join('') || '<p class="note">No screenshots match.</p>';
    $('a-count').textContent = `Showing ${visible.length} of ${posts.length}`;
  }

  function open(i) {
    current = (i + visible.length) % visible.length;
    const p = visible[current];
    boxImg.src = GP.screenshotURL(p.screenshot);
    boxImg.alt = `Screenshot of ${GP.displayName(p.username)}'s ${GP.fmtBTC(p.btc)} BTC milestone post`;
    boxCap.innerHTML = caption(p);
    if (!box.open) box.showModal();
    history.replaceState(null, '', '#' + encodeURIComponent(p.screenshot));
  }

  function close() {
    box.close();
  }

  box.addEventListener('close', () => {
    history.replaceState(null, '', location.pathname + location.search);
    const el = document.getElementById(visible[current] && visible[current].screenshot);
    if (el) el.querySelector('button').focus();
  });
  gallery.addEventListener('click', e => {
    const btn = e.target.closest('button[data-i]');
    if (btn) open(+btn.dataset.i);
  });
  box.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => open(current + +b.dataset.step)));
  box.querySelector('.close-btn').addEventListener('click', close);
  box.addEventListener('click', e => { if (e.target === box || e.target.classList.contains('lightbox-inner')) close(); });
  box.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') open(current + 1);
    if (e.key === 'ArrowLeft') open(current - 1);
  });

  [search, amount, sort].forEach(el => el.addEventListener(el === search ? 'input' : 'change', render));
  render();

  // Deep link from the data table / homepage: scroll to and open that screenshot.
  const target = decodeURIComponent(location.hash.slice(1));
  if (target) {
    const i = visible.findIndex(p => p.screenshot === target);
    if (i >= 0) {
      const el = document.getElementById(target);
      el.classList.add('highlight');
      el.scrollIntoView({ block: 'center' });
      open(i);
    }
  }
})().catch(err => {
  console.error(err);
  document.getElementById('gallery').innerHTML = '<p class="note">Could not load the archive. Please refresh.</p>';
});
