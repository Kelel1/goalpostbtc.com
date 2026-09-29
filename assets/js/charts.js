// GoalPost BTC — Plotly chart builders shared by the data page and the
// homepage "Chart of the Day". Each builder takes (el, posts, prices) where
// posts are sorted oldest → newest and prices comes from GP.loadPrices().
(function () {
  'use strict';

  const BTC = '#f7931a';
  const BTC_SOFT = 'rgba(247,147,26,0.35)';
  const TEXT = '#e8d5b0';
  const DIM = '#8a7355';
  const GRID = 'rgba(247,147,26,0.08)';
  const PRICE = '#9a9084';
  const WINDOW_DAYS = 90;

  const config = { displayModeBar: false, responsive: true };

  function axis(extra) {
    return Object.assign({
      color: DIM,
      gridcolor: GRID,
      linecolor: 'rgba(247,147,26,0.2)',
      zeroline: false,
      tickfont: { family: 'IBM Plex Mono, monospace', size: 11, color: DIM },
      title: { font: { family: 'IBM Plex Mono, monospace', size: 11, color: DIM } },
    }, extra || {});
  }

  function layout(extra) {
    return Object.assign({
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: 'IBM Plex Sans, sans-serif', color: TEXT, size: 12 },
      margin: { l: 64, r: 24, t: 12, b: 48 },
      hovermode: 'closest',
      hoverlabel: { bgcolor: '#221a12', bordercolor: BTC, font: { family: 'IBM Plex Mono, monospace', color: TEXT, size: 12 } },
      legend: { orientation: 'h', x: 0, y: 1.02, yanchor: 'bottom', font: { size: 11, color: DIM }, bgcolor: 'rgba(0,0,0,0)' },
      xaxis: axis({ type: 'date' }),
      yaxis: axis(),
    }, extra || {});
  }

  function empty(el, msg) {
    Plotly.purge(el);
    el.innerHTML = `<div class="chart-empty">${msg || 'Not enough data for this view.'}</div>`;
  }

  function draw(el, traces, lay) {
    if (el.querySelector('.chart-empty')) el.innerHTML = '';
    return Plotly.react(el, traces, lay, config);
  }

  // Trailing-window statistic evaluated at each post date.
  function rolling(points, stat, minCount) {
    const out = { x: [], y: [] };
    let start = 0;
    for (let i = 0; i < points.length; i++) {
      const now = GP.dayNumber(points[i].date);
      while (GP.dayNumber(points[start].date) <= now - WINDOW_DAYS) start++;
      if (i + 1 < points.length && points[i + 1].date === points[i].date) continue; // one value per day
      const win = points.slice(start, i + 1).map(p => p.value);
      if (win.length >= minCount) { out.x.push(points[i].date); out.y.push(stat(win)); }
    }
    return out;
  }
  const mean = v => v.reduce((a, b) => a + b, 0) / v.length;

  function priceTrace(prices, from, to) {
    const x = [], y = [];
    prices.dates.forEach((d, i) => { if (d >= from && d <= to) { x.push(d); y.push(prices.values[i]); } });
    return {
      x, y, yaxis: 'y2', type: 'scatter', mode: 'lines', name: 'BTC price (USD)',
      line: { color: PRICE, width: 1.25, dash: 'dot' },
      hovertemplate: 'BTC price: $%{y:,.0f}<extra></extra>',
    };
  }
  const priceAxis = () => axis({ overlaying: 'y', side: 'right', showgrid: false, tickprefix: '$', tickformat: '~s', title: { text: '' } });

  const same = (a, b) => Math.abs(a - b) < 1e-9;
  const logTicks = { tickvals: [0.001, 0.01, 0.1, 1, 10], ticktext: ['0.001', '0.01', '0.1', '1', '10'] };

  const charts = {
    clustering: {
      title: 'Milestone Clustering',
      desc: "Bitcoin holders don't celebrate arbitrary amounts — they gravitate toward round numbers. These are the most-celebrated milestone amounts (any amount posted more than once).",
      caption: 'Most common milestone amounts by number of posts',
      render(el, posts) {
        const groups = new Map();
        posts.forEach(p => {
          const key = +p.btc.toFixed(8);
          const g = groups.get(key) || { btc: key, count: 0, first: p.date, last: p.date };
          g.count++; g.last = p.date;
          groups.set(key, g);
        });
        const repeated = [...groups.values()].filter(g => g.count > 1);
        const top = (repeated.length >= 5 ? repeated : [...groups.values()])
          .sort((a, b) => b.count - a.count || b.btc - a.btc).slice(0, 20)
          .sort((a, b) => a.btc - b.btc);
        if (top.length < 2) return empty(el);
        const max = Math.max(...top.map(g => g.count));
        return draw(el, [{
          type: 'bar', orientation: 'h',
          x: top.map(g => g.count),
          y: top.map(g => GP.fmtBTC(g.btc) + ' BTC'),
          marker: { color: top.map(g => `rgba(247,147,26,${0.3 + 0.7 * g.count / max})`) },
          customdata: top.map(g => [GP.fmtDate(g.first), GP.fmtDate(g.last)]),
          hovertemplate: '<b>%{y}</b><br>%{x} posts<br>%{customdata[0]} – %{customdata[1]}<extra></extra>',
        }], layout({
          margin: { l: 118, r: 24, t: 8, b: 44 },
          xaxis: axis({ title: { text: 'Posts' }, dtick: max > 12 ? 5 : 1 }),
          yaxis: axis({ type: 'category', automargin: true, showgrid: false }),
          hovermode: 'y',
        }));
      },
    },

    trend: {
      title: 'Hyperbitcoinization Trend',
      desc: `The thesis: as Bitcoin's price rises, the amount people celebrate should shrink. Each dot is one milestone post (log scale); the line is the ${WINDOW_DAYS}-day rolling median, with BTC price dotted behind it.`,
      caption: `Milestone amounts over time · ${WINDOW_DAYS}-day rolling median · BTC price`,
      render(el, posts, prices) {
        if (posts.length < 2) return empty(el);
        const from = posts[0].date, to = posts[posts.length - 1].date;
        const med = rolling(posts.map(p => ({ date: p.date, value: p.btc })), GP.median, 3);
        const traces = [
          {
            x: posts.map(p => p.date), y: posts.map(p => p.btc), type: 'scatter', mode: 'markers', name: 'Milestone post',
            marker: { color: BTC, size: 7, opacity: 0.55, line: { width: 0 } },
            customdata: posts.map(p => [GP.displayName(p.username), GP.fmtBTC(p.btc), GP.fmtDate(p.date)]),
            hovertemplate: '<b>%{customdata[0]}</b><br>%{customdata[1]} BTC<br>%{customdata[2]}<extra></extra>',
          },
          {
            x: med.x, y: med.y, type: 'scatter', mode: 'lines', name: `${WINDOW_DAYS}-day median`,
            line: { color: TEXT, width: 2.5, shape: 'spline', smoothing: 0.6 },
            hovertemplate: 'Median: %{y:.4f} BTC<extra></extra>',
          },
        ];
        if (prices && prices.dates.length) traces.push(priceTrace(prices, from, to));
        return draw(el, traces, layout({
          margin: { l: 64, r: 56, t: 12, b: 48 },
          yaxis: axis(Object.assign({ type: 'log', title: { text: 'BTC celebrated' } }, logTicks)),
          yaxis2: priceAxis(),
        }));
      },
    },

    dollars: {
      title: 'Milestones in Dollars',
      desc: "The same posts valued in USD on the day they were made. If the goalposts move down in BTC while holding steady in dollars, people are chasing a dollar figure rather than a number of coins.",
      caption: `USD value of each milestone on its post date · ${WINDOW_DAYS}-day rolling median`,
      render(el, posts, prices) {
        if (!prices || !prices.dates.length) return empty(el, 'BTC price history unavailable.');
        const pts = posts.map(p => ({ ...p, price: prices.on(p.date) })).filter(p => p.price);
        if (pts.length < 2) return empty(el);
        pts.forEach(p => { p.value = p.btc * p.price; });
        const med = rolling(pts, GP.median, 3);
        return draw(el, [
          {
            x: pts.map(p => p.date), y: pts.map(p => p.value), type: 'scatter', mode: 'markers', name: 'Milestone value',
            marker: { color: BTC, size: 7, opacity: 0.55 },
            customdata: pts.map(p => [GP.displayName(p.username), GP.fmtBTC(p.btc), GP.fmtUSD(p.price)]),
            hovertemplate: '<b>%{customdata[0]}</b><br>%{customdata[1]} BTC ≈ $%{y:,.0f}<br>BTC at %{customdata[2]}<extra></extra>',
          },
          {
            x: med.x, y: med.y, type: 'scatter', mode: 'lines', name: `${WINDOW_DAYS}-day median`,
            line: { color: TEXT, width: 2.5, shape: 'spline', smoothing: 0.6 },
            hovertemplate: 'Median: $%{y:,.0f}<extra></extra>',
          },
        ], layout({
          yaxis: axis({ type: 'log', title: { text: 'USD value' }, tickvals: [1, 10, 100, 1e3, 1e4, 1e5, 1e6], ticktext: ['$1', '$10', '$100', '$1k', '$10k', '$100k', '$1M'] }),
        }));
      },
    },

    race: {
      title: 'The 1 vs 0.1 Race',
      desc: 'Running count of posts celebrating exactly 1 BTC versus exactly 0.1 BTC. In the musing “21” the prediction was that 0.1 BTC would overtake 1 BTC by the end of 2026 — this chart keeps score.',
      caption: 'Cumulative posts at exactly 1 BTC and exactly 0.1 BTC',
      render(el, posts) {
        const series = (target) => {
          let n = 0; const x = [], y = [];
          posts.forEach(p => { if (same(p.btc, target)) { n++; x.push(p.date); y.push(n); } });
          return { x, y };
        };
        const one = series(1), tenth = series(0.1);
        if (!one.x.length && !tenth.x.length) return empty(el);
        const end = posts[posts.length - 1].date;
        const extend = s => s.x.length ? { x: [...s.x, end], y: [...s.y, s.y[s.y.length - 1]] } : s;
        const a = extend(one), b = extend(tenth);
        return draw(el, [
          { ...a, type: 'scatter', mode: 'lines', name: `1 BTC (${one.y.length})`, line: { color: BTC, width: 3, shape: 'hv' }, hovertemplate: '1 BTC posts: %{y}<extra></extra>' },
          { ...b, type: 'scatter', mode: 'lines', name: `0.1 BTC (${tenth.y.length})`, line: { color: TEXT, width: 3, shape: 'hv', dash: 'dash' }, hovertemplate: '0.1 BTC posts: %{y}<extra></extra>' },
        ], layout({ hovermode: 'x unified', yaxis: axis({ title: { text: 'Posts to date' }, rangemode: 'tozero' }) }));
      },
    },

    users: {
      title: 'Unique Users Over Time',
      desc: 'Cumulative count of distinct people posting milestones (line), with first-time posters per month (bars).',
      caption: 'Cumulative unique users · new users per month',
      render(el, posts) {
        const seen = new Set(), firsts = [];
        posts.forEach(p => { const k = p.username.toLowerCase(); if (!seen.has(k)) { seen.add(k); firsts.push(p); } });
        if (firsts.length < 2) return empty(el);
        const perMonth = new Map();
        firsts.forEach(p => { const m = p.date.slice(0, 7) + '-15'; perMonth.set(m, (perMonth.get(m) || 0) + 1); });
        const months = [...perMonth.keys()].sort();
        return draw(el, [
          {
            x: months, y: months.map(m => perMonth.get(m)), type: 'bar', name: 'New users / month',
            marker: { color: BTC_SOFT }, hovertemplate: '%{x|%b %Y}: %{y} new<extra></extra>',
          },
          {
            x: firsts.map(p => p.date), y: firsts.map((_, i) => i + 1), yaxis: 'y2', type: 'scatter', mode: 'lines',
            name: 'Cumulative unique users', line: { color: BTC, width: 3 }, hovertemplate: '%{x|%b %d, %Y}: %{y} users<extra></extra>',
          },
        ], layout({
          margin: { l: 56, r: 56, t: 12, b: 48 },
          yaxis: axis({ title: { text: 'New / month' }, rangemode: 'tozero' }),
          yaxis2: axis({ overlaying: 'y', side: 'right', showgrid: false, rangemode: 'tozero', title: { text: '' } }),
          bargap: 0.25,
        }));
      },
    },

    heartbeat: {
      title: 'Community Heartbeat',
      desc: `Days between consecutive milestone posts. A low, steady line means a steady stream of milestones; spikes mean silence — nobody hitting milestones, or nobody posting about it. The line is a ${WINDOW_DAYS}-day rolling average. On the data page this chart always covers the full dataset — it isn't affected by the date or username filters.`,
      caption: `Days between posts · ${WINDOW_DAYS}-day rolling average`,
      render(el, posts, prices) {
        const days = [...new Set(posts.map(p => p.date))];
        const gaps = [];
        for (let i = 1; i < days.length; i++) gaps.push({ date: days[i], value: GP.dayNumber(days[i]) - GP.dayNumber(days[i - 1]) });
        if (gaps.length < 2) return empty(el);
        const avg = rolling(gaps, mean, 2);
        const traces = [
          { x: gaps.map(g => g.date), y: gaps.map(g => g.value), type: 'bar', name: 'Days since previous post', width: 3 * 86400000, marker: { color: 'rgba(247,147,26,0.55)' }, hovertemplate: '%{x|%b %d, %Y}: %{y} days since previous<extra></extra>' },
          { x: avg.x, y: avg.y, type: 'scatter', mode: 'lines', name: `${WINDOW_DAYS}-day average gap`, line: { color: BTC, width: 3, shape: 'spline', smoothing: 0.6 }, hovertemplate: 'Avg gap: %{y:.1f} days<extra></extra>' },
        ];
        if (prices && prices.dates.length) traces.push(priceTrace(prices, days[0], days[days.length - 1]));
        return draw(el, traces, layout({
          margin: { l: 56, r: 56, t: 12, b: 48 },
          yaxis: axis({ title: { text: 'Days between posts' }, rangemode: 'tozero' }),
          yaxis2: priceAxis(),
          bargap: 0.1,
        }));
      },
    },
  };

  GP.charts = charts;
})();
