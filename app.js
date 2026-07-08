const $ = (sel, el = document) => el.querySelector(sel);
const fmtMoney = (n) =>
  n == null ? '—' : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}k` : `$${n}`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function countUp(el, target, ms = 700) {
  const start = performance.now();
  const tick = (t) => {
    const p = Math.min((t - start) / ms, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString();
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function itemLi(item) {
  return `<li data-search="${esc((item.title + ' ' + (item.meta ?? '')).toLowerCase())}">
    <a href="${esc(item.url)}" target="_blank" rel="noopener">
      <div class="item-title">${esc(item.title)}</div>
      <div class="item-meta">
        ${item.points != null ? `<span class="pts">▲ ${item.points}</span>` : ''}
        ${item.meta ? `<span>${esc(item.meta)}</span>` : ''}
        <span class="badge">${esc(item.source)}</span>
      </div>
    </a>
  </li>`;
}

function mrrLi(s, rank) {
  const delta = s.mrrDelta == null ? '' :
    s.mrrDelta >= 0 ? `<span class="delta-up">▲ ${fmtMoney(s.mrrDelta)}</span>`
                    : `<span class="delta-down">▼ ${fmtMoney(-s.mrrDelta)}</span>`;
  const rankBadge = s.rankDelta == null || s.rankDelta === 0 ? '' :
    s.rankDelta > 0 ? `<span class="delta-up">↑${s.rankDelta}</span>` : `<span class="delta-down">↓${-s.rankDelta}</span>`;
  const inner = `
      <div class="item-title">#${rank + 1} ${esc(s.name)} ${rankBadge}</div>
      <div class="item-meta">
        <span class="mrr-val">${fmtMoney(s.mrr)}/mo</span> ${delta}
        ${s.growthPct != null ? `<span>${s.growthPct > 0 ? '+' : ''}${s.growthPct}% growth</span>` : ''}
        ${s.description ? `<span>${esc(s.description)}</span>` : ''}
      </div>`;
  return `<li data-search="${esc(s.name.toLowerCase())}">
    ${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${inner}</a>` : `<a>${inner}</a>`}
  </li>`;
}

function filingLi(f) {
  const date = `${f.dateFiled.slice(0, 4)}-${f.dateFiled.slice(4, 6)}-${f.dateFiled.slice(6, 8)}`;
  return `<li data-search="${esc(f.company.toLowerCase())}">
    <a href="${esc(f.url)}" target="_blank" rel="noopener">
      <div class="item-title">${esc(f.company)}</div>
      <div class="item-meta"><span class="badge">Form ${esc(f.formType)}</span><span>filed ${date}</span><span>CIK ${esc(f.cik)}</span></div>
    </a>
  </li>`;
}

function panel(key, title, lis, extraHtml = '') {
  return `<section class="panel" data-panel="${key}">
    <h2>${title} <span class="count">${lis.length}</span></h2>
    ${extraHtml}
    <ul>${lis.length ? lis.join('') : '<div class="empty">No data today — check pipeline logs.</div>'}</ul>
  </section>`;
}

const PANEL_TABS = {
  headlines: ['headlines'], launches: ['launches'], mrr: ['mrr'],
  repos: ['repos'], filings: ['filings'], news: ['news'],
};

async function main() {
  let snap;
  try {
    snap = await (await fetch('data/latest.json', { cache: 'no-store' })).json();
  } catch {
    $('#grid').innerHTML = '<div class="empty">Could not load data/latest.json — run <code>npm run pipeline</code> first.</div>';
    return;
  }
  const s = snap.sections;

  $('#date-badge').textContent = snap.date;
  $('#generated-at').textContent = `Generated ${new Date(snap.generatedAt).toLocaleString()}`;

  const chips = [
    ['Total items', snap.stats.totalItems],
    ['Headlines', s.headlines.length],
    ['Launches', s.launches.length],
    ['MRR startups', s.mrrLeaderboard.length],
    ['New repos', s.trendingRepos.length],
    ['Form D filings', s.formDFilings.length],
  ];
  $('#stats-row').innerHTML = chips.map(([label]) =>
    `<div class="stat-chip"><div class="num">0</div><div class="label">${label}</div></div>`).join('');
  document.querySelectorAll('.stat-chip .num').forEach((el, i) => countUp(el, chips[i][1]));

  const topicChips = s.emergingTopics.map((t) =>
    `<span class="topic-chip" title="count ${t.count}">${esc(t.term)}<span class="vel">×${t.velocity.toFixed(1)}</span></span>`).join('');

  $('#grid').innerHTML = [
    panel('headlines', 'Top Headlines', s.headlines.map(itemLi)),
    panel('launches', 'New Launches', s.launches.map(itemLi)),
    panel('mrr', 'Verified MRR Leaderboard', s.mrrLeaderboard.map(mrrLi)),
    panel('repos', 'Trending New Repos', s.trendingRepos.map(itemLi)),
    panel('filings', 'Fresh Form D Filings (SEC)', s.formDFilings.map(filingLi)),
    panel('news', 'Startup News', s.news.map(itemLi)),
    panel('topics', 'Emerging Fields', [], `<div class="topic-cloud">${topicChips || '<span class="empty">Velocity builds after a few days of snapshots.</span>'}</div>`),
  ].join('');

  // Tabs
  $('#tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    const key = tab.dataset.tab;
    document.querySelectorAll('.panel').forEach((p) => {
      const show = key === 'all' || (PANEL_TABS[key] ?? []).includes(p.dataset.panel) || (key === 'all' && p.dataset.panel === 'topics');
      p.classList.toggle('hidden', !show && key !== 'all');
    });
  });

  // Search ("/" focuses; filters every list item live)
  const search = $('#search');
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== search) { e.preventDefault(); search.focus(); }
  });
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    document.querySelectorAll('li[data-search]').forEach((li) => {
      li.classList.toggle('hidden', q !== '' && !li.dataset.search.includes(q));
    });
  });
}

main();
