const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtMoney = (n) =>
  n == null ? '—' : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}k` : `$${n}`;
const domainOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; } };
// Allow only http(s) in hrefs — blocks javascript:/data:/vbscript: scheme XSS from feed data.
const safeUrl = (u) => {
  if (!u) return '#';
  try { const p = new URL(u, location.href); return (p.protocol === 'https:' || p.protocol === 'http:') ? p.href : '#'; }
  catch { return '#'; }
};
const relTime = (iso) => {
  if (!iso) return '';
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (!Number.isFinite(s) || s < 0) return '';
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
};

function countUp(el, target, ms = 650) {
  const start = performance.now();
  const tick = (t) => {
    const p = Math.min((t - start) / ms, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString();
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function favImg(item) {
  const dom = item.domain ?? domainOf(item.url);
  return dom ? `<img class="fav" loading="lazy" referrerpolicy="no-referrer" alt=""
    src="https://icons.duckduckgo.com/ip3/${esc(dom)}.ico" onerror="this.remove()">` : '';
}

function thumbImg(src) {
  return src ? `<span class="thumbbox"><img class="thumb" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt=""
    src="${esc(src)}" onerror="this.closest('.thumbbox').remove()"></span>` : '';
}

function itemLi(item, { thumb = false, ghImage = false } = {}) {
  const img = thumb ? thumbImg(ghImage ? `https://opengraph.githubassets.com/1/${esc(item.title)}` : item.image) : '';
  const comments = item.commentsUrl && item.commentsUrl !== item.url
    ? ` <a class="cmt" href="${esc(safeUrl(item.commentsUrl))}" target="_blank" rel="noopener">↳ thread</a>` : '';
  return `<li data-search="${esc(`${item.title} ${item.meta ?? ''} ${item.source}`.toLowerCase())}">
    <a class="row" href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener">
      ${img}
      <span class="row-body">
        <div class="item-title">${esc(item.title)}</div>
        <div class="item-meta">
          ${favImg(item)}
          ${item.points != null ? `<span class="pts">${item.points}</span>` : ''}
          ${item.meta ? `<span>${esc(item.meta)}</span>` : ''}
          ${item.createdAt ? `<span>${relTime(item.createdAt)}</span>` : ''}${comments}
        </div>
      </span>
    </a>
  </li>`;
}

function filingLi(f) {
  const date = `${f.dateFiled.slice(0, 4)}-${f.dateFiled.slice(4, 6)}-${f.dateFiled.slice(6, 8)}`;
  return `<li data-search="${esc(f.company.toLowerCase())}">
    <a class="row" href="${esc(safeUrl(f.url))}" target="_blank" rel="noopener">
      <span class="row-body">
        <div class="item-title">${esc(f.company)}</div>
        <div class="item-meta"><span class="amber">FORM ${esc(f.formType)}</span><span>${date}</span><span>CIK ${esc(f.cik)}</span></div>
      </span>
    </a>
  </li>`;
}

function sparkline(values, w = 72, h = 20) {
  if (!Array.isArray(values) || values.length < 2) return '';
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) =>
    `${(1 + (i / (values.length - 1)) * (w - 2)).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`
  ).join(' ');
  const up = values[values.length - 1] >= values[0];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <polyline points="${pts}" fill="none" stroke="var(--${up ? 'up' : 'down'})" stroke-width="1.5"/></svg>`;
}

// Company logo tile with a lettered fallback (shown when no logo / image errors).
function logoImg(logo, name, cls = 'mrr-logo') {
  const initial = esc(((name ?? '?').trim().charAt(0) || '?').toUpperCase());
  const img = logo && /^https:\/\//.test(logo)
    ? `<img class="${cls}" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="" src="${esc(logo)}" onerror="this.remove()">`
    : '';
  return `<span class="${cls}-wrap" data-i="${initial}">${img}</span>`;
}

// 30-day growth cell, TrustMRR-style (green up / red down).
function growthCell(pct) {
  if (typeof pct !== 'number') return DASH;
  return `<span class="${pct >= 0 ? 'growth-up' : 'growth-down'}">${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%</span>`;
}
const DASH = '<span class="rank">—</span>';
const moneyCell = (n) => (typeof n === 'number' ? fmtMoney(n) : DASH);
const fmtTraffic = (n) => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return DASH;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return `${n}`;
};
const perVisitorCell = (n) => (typeof n === 'number' && Number.isFinite(n) ? `$${n.toFixed(2)}` : DASH);

/* ---- Hero "Today's Pulse" strip (built from real data, each card null-checked) ---- */
function heroLeaderCard(m) {
  if (!m) return '';
  return `<a class="hero-card hero-leader" href="${esc(safeUrl(m.url))}" target="_blank" rel="noopener">
    <div class="hero-eyebrow"><span class="amber">▲ TOP MRR</span></div>
    <div class="hero-leader-head">${logoImg(m.logo, m.name, 'hero-logo')}<div class="hero-name">${esc(m.name)}</div></div>
    <div class="hero-figure">${fmtMoney(m.mrr)}</div>
    <div class="hero-sub">${growthCell(m.growthPct)}<span class="hero-tag">30d</span></div>
    <div class="hero-spark">${sparkline(m.history, 240, 40)}</div>
  </a>`;
}

function heroLaunchCard(l) {
  if (!l) return '';
  const cover = l.image
    ? `<span class="hero-cover"><img loading="lazy" decoding="async" referrerpolicy="no-referrer" alt=""
        src="${esc(l.image)}" onerror="this.closest('.hero-cover').remove()"></span>`
    : '';
  return `<a class="hero-card hero-launch" href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">
    <div class="hero-eyebrow"><span class="amber">LAUNCHING NOW</span></div>
    ${cover}
    <div class="hero-name hero-name-md">${esc(l.title)}</div>
    <div class="hero-sub">
      ${l.points != null ? `<span class="pts">▲ ${l.points}</span>` : ''}
      ${l.source ? `<span class="hero-tag">${esc(l.source)}</span>` : ''}
    </div>
  </a>`;
}

function heroFilingCard(f) {
  if (!f) return '';
  const date = f.dateFiled && f.dateFiled.length >= 8
    ? `${f.dateFiled.slice(0, 4)}-${f.dateFiled.slice(4, 6)}-${f.dateFiled.slice(6, 8)}` : '';
  return `<a class="hero-card hero-filing" href="${esc(safeUrl(f.url))}" target="_blank" rel="noopener">
    <div class="hero-eyebrow"><span class="amber">JUST FILED</span></div>
    <div class="hero-badge">FORM ${esc(f.formType)}</div>
    <div class="hero-name hero-name-md">${esc(f.company)}</div>
    <div class="hero-sub">
      ${date ? `<span class="hero-tag">${date}</span>` : ''}
      ${f.cik ? `<span class="hero-tag">CIK ${esc(f.cik)}</span>` : ''}
    </div>
  </a>`;
}

function buildHero(s) {
  const cards = [
    heroLeaderCard((s.mrrLeaderboard ?? [])[0]),
    heroLaunchCard((s.launches ?? [])[0]),
    heroFilingCard((s.formDFilings ?? [])[0]),
  ].filter(Boolean);
  if (!cards.length) return '';
  return `<div class="hero-head">Today's Pulse</div><div class="hero-grid">${cards.join('')}</div>`;
}

/* ---- MRR sortable table ---- */
let mrrData = [];
let mrrSort = { key: 'rank', dir: 1 };

function renderMrrBody() {
  const { key, dir } = mrrSort;
  const sorted = [...mrrData].sort((a, b) => {
    const av = key === 'rank' ? a.rank : key === 'name' ? a.name?.toLowerCase() : a[key];
    const bv = key === 'rank' ? b.rank : key === 'name' ? b.name?.toLowerCase() : b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
  });
  $('#mrr-body').innerHTML = sorted.map((s) => `
    <tr data-search="${esc((s.name ?? '').toLowerCase())}">
      <td class="rank">${s.rank}</td>
      <td class="co">${logoImg(s.logo, s.name)}${s.url ? `<a class="mrr-name" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener">${esc(s.name)}</a>` : `<span class="mrr-name">${esc(s.name)}</span>`}</td>
      <td class="num">${moneyCell(s.mrr)}</td>
      <td class="num">${moneyCell(s.mrrValue)}</td>
      <td class="num">${growthCell(s.growthPct)}</td>
      <td class="num">${fmtTraffic(s.traffic)}</td>
      <td class="num">${perVisitorCell(s.revPerVisitor)}</td>
      <td>${sparkline(s.history)}</td>
    </tr>`).join('');
  document.querySelectorAll('.mrr-table th').forEach((th) =>
    th.classList.toggle('sorted', th.dataset.key === key));
  applySearch($('#search').value);
}

function mrrPanel(board) {
  mrrData = board.map((s, i) => ({ ...s, rank: i + 1 }));
  return `<section class="panel panel-wide" data-panel="mrr">
    <h2>Revenue Leaderboard <span class="count">${board.length}</span></h2>
    <div class="mrr-scroll"><table class="mrr-table">
      <thead><tr>
        <th data-key="rank">#</th><th data-key="name">Company</th>
        <th class="num" data-key="mrr">Revenue</th>
        <th class="num" data-key="mrrValue">MRR</th>
        <th class="num" data-key="growthPct">Growth</th>
        <th class="num" data-key="traffic">Traffic</th>
        <th class="num" data-key="revPerVisitor">$/visitor</th>
        <th class="nosort">14d</th>
      </tr></thead>
      <tbody id="mrr-body"></tbody>
    </table></div>
  </section>`;
}

/* ---- Ticker (signature) ---- */
function buildTicker(s) {
  const chips = [];
  for (const m of (s.mrrLeaderboard ?? [])
    .filter((x) => x.mrrDelta)
    .sort((a, b) => Math.abs(b.mrrDelta) - Math.abs(a.mrrDelta)).slice(0, 12)) {
    const cls = m.mrrDelta > 0 ? 'up' : 'down';
    const arrow = m.mrrDelta > 0 ? '▲' : '▼';
    chips.push(`<a class="tick" href="${esc(safeUrl(m.url))}" target="_blank" rel="noopener">${esc(m.name)} <b class="${cls}">${arrow} ${fmtMoney(Math.abs(m.mrrDelta))}</b></a>`);
  }
  for (const f of (s.formDFilings ?? []).slice(0, 8)) {
    chips.push(`<a class="tick" href="${esc(safeUrl(f.url))}" target="_blank" rel="noopener"><b class="amber">FORM ${esc(f.formType)}</b> ${esc(f.company)}</a>`);
  }
  for (const r of (s.trendingRepos ?? []).slice(0, 5)) {
    chips.push(`<a class="tick" href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener">${esc(r.title)} <b class="up">★ ${(r.points ?? 0).toLocaleString()}</b></a>`);
  }
  if (!chips.length) return '';
  const seg = chips.join('<span class="tick-sep">·</span>') + '<span class="tick-sep">·</span>';
  return `<div class="ticker-track">${seg}${seg}</div>`; // duplicated for seamless -50% loop
}

function panel(key, title, lis, extraHtml = '') {
  return `<section class="panel" data-panel="${key}">
    <h2>${title} <span class="count">${lis.length}</span></h2>
    ${extraHtml}
    <ul>${lis.length ? lis.join('') : '<div class="empty">Nothing here yet today. The pipeline refreshes at 11:00 UTC.</div>'}</ul>
  </section>`;
}

const PANEL_TABS = {
  headlines: ['headlines'], launches: ['launches'], mrr: ['mrr'], community: ['community'],
  repos: ['repos'], filings: ['filings'], news: ['news'],
};

function applySearch(qRaw) {
  const q = qRaw.trim().toLowerCase();
  document.querySelectorAll('[data-search]').forEach((el) => {
    el.classList.toggle('hidden', q !== '' && !el.dataset.search.includes(q));
  });
}

async function main() {
  let snap;
  try {
    snap = await (await fetch('data/latest.json', { cache: 'no-store' })).json();
  } catch {
    $('#grid').innerHTML = '<div class="empty">Could not load data/latest.json. Run <code>npm run pipeline</code>, then reload.</div>';
    return;
  }
  const s = snap.sections;
  const community = s.community ?? [];

  $('#date-badge').textContent = snap.date;
  $('#generated-at').textContent = `Generated ${new Date(snap.generatedAt).toLocaleString()}`;
  $('#ticker').innerHTML = buildTicker(s);
  $('#hero').innerHTML = buildHero(s);

  const td = snap.stats.totalDelta;
  const tdHtml = td == null || td === 0 ? '' :
    `<span class="tdelta ${td > 0 ? 'delta-up' : 'delta-down'}">${td > 0 ? '▲' : '▼'}${Math.abs(td)}</span>`;
  const chips = [
    ['Items today', snap.stats.totalItems, tdHtml],
    ['Headlines', s.headlines.length, ''],
    ['Launches', s.launches.length, ''],
    ['MRR tracked', s.mrrLeaderboard.length, ''],
    ['Community', community.length, ''],
    ['Repos', s.trendingRepos.length, ''],
    ['Filings', s.formDFilings.length, ''],
  ];
  $('#stats-row').innerHTML = chips.map(([label, , extra]) =>
    `<div class="stat"><div class="num"><span class="cn">0</span>${extra}</div><div class="label">${label}</div></div>`).join('');
  document.querySelectorAll('.stat .num .cn').forEach((el, i) => countUp(el, chips[i][1]));

  const topicChips = (s.emergingTopics ?? []).map((t) =>
    `<button class="topic-chip" data-term="${esc(t.term)}" title="count ${t.count}">${esc(t.term)}<span class="vel">×${t.velocity.toFixed(1)}</span></button>`).join('');

  $('#grid').innerHTML = `
    ${mrrPanel(s.mrrLeaderboard)}
    <div class="col-main">
      ${panel('headlines', 'Headlines', s.headlines.map((i) => itemLi(i, { thumb: true })))}
      ${panel('community', 'Community', community.map((i) => itemLi(i, { thumb: true })))}
      ${panel('news', 'News', s.news.map((i) => itemLi(i, { thumb: true })))}
    </div>
    <div class="col-rail">
      ${panel('launches', 'Launches', s.launches.map((i) => itemLi(i, { thumb: true })))}
      ${panel('repos', 'New repos', s.trendingRepos.map((i) => itemLi(i, { thumb: true, ghImage: true })))}
      ${panel('filings', 'Form D filings', s.formDFilings.map(filingLi))}
      ${panel('topics', 'Emerging fields', [], `<div class="topic-cloud">${topicChips || '<span class="empty">Velocity builds after a few days of snapshots.</span>'}</div>`)}
    </div>`;
  renderMrrBody();

  /* Tabs + keyboard 1-8 */
  const tabs = [...document.querySelectorAll('.tab')];
  const activateTab = (tab) => {
    tabs.forEach((t) => t.classList.toggle('active', t === tab));
    const key = tab.dataset.tab;
    document.querySelectorAll('.panel').forEach((p) => {
      const show = key === 'all' || (PANEL_TABS[key] ?? []).includes(p.dataset.panel);
      p.classList.toggle('hidden', !show);
    });
  };
  $('#tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (tab) activateTab(tab);
  });

  /* Search */
  const search = $('#search');
  search.addEventListener('input', () => applySearch(search.value));
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName ?? '');
    if (e.key === '/' && !typing) { e.preventDefault(); search.focus(); }
    else if (e.key === 'Escape' && typing) { search.value = ''; applySearch(''); search.blur(); }
    else if (!typing && /^[1-8]$/.test(e.key) && tabs[e.key - 1]) activateTab(tabs[e.key - 1]);
  });

  /* Topic chips filter the search */
  $('#grid').addEventListener('click', (e) => {
    const chip = e.target.closest('.topic-chip');
    if (!chip) return;
    search.value = chip.dataset.term;
    applySearch(chip.dataset.term);
  });

  /* MRR sort */
  $('#grid').addEventListener('click', (e) => {
    const th = e.target.closest('.mrr-table th');
    if (!th || !th.dataset.key) return; // e.g. the sparkline "14d" column is not sortable
    const key = th.dataset.key;
    mrrSort = { key, dir: mrrSort.key === key ? -mrrSort.dir : (key === 'name' || key === 'rank' ? 1 : -1) };
    renderMrrBody();
  });

  /* Theme toggle */
  $('#theme-toggle').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme
      ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('sp-theme', next);
  });
}

main();
