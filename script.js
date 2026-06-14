// ── CONFIG ───────────────────────────────────────────────────────────────────
const API_BASE = 'https://kaz.alwaysdata.net/api.php';

// ── STATE ────────────────────────────────────────────────────────────────────
const STATE = {
  q:             '',
  filter:        'all',
  family:        'all',
  dialect:       'all',
  inherited:     false,
  showEtym:      true,
  collapseOther: false,
  sort:          'num',
  page:          1,
  perPage:       25,
};

// Read URL params on load
(function() {
  const p = new URLSearchParams(location.search);
  if (p.get('q'))        STATE.q        = p.get('q');
  if (p.get('filter'))   STATE.filter   = p.get('filter');
  if (p.get('family'))   STATE.family   = p.get('family');
  if (p.get('dialect'))  STATE.dialect  = p.get('dialect');
  if (p.get('sort'))     STATE.sort     = p.get('sort');
  if (p.get('page'))     STATE.page     = Math.max(1, parseInt(p.get('page')) || 1);
  if (p.get('per_page')) STATE.perPage  = Math.min(100, Math.max(10, parseInt(p.get('per_page')) || 25));
  if (p.get('inherited') === '1') STATE.inherited = true;
})();

const DIALECT_NAMES = {
  'gil.':'Gilgiti','koh.':'Kohistani','gur.':'Guresi',
  'pales.':'Palesi','bro.':'Brokpa','jij.':'Jijelut',
  'punl.':'Puniali','chil.':'Chilasi','dr.':'Dras',
  'kōl.':'Kola','Sh.':'General'
};
const FAMILY_CLASS = {
  'NIA':'lb-nia','MIA':'lb-mia','OIA':'lb-oia',
  'Dardic':'lb-dardic','Kafiri':'lb-kafiri','Iranian':'lb-iranian'
};

// ── DOM REFS ─────────────────────────────────────────────────────────────────
const $            = id => document.getElementById(id);
const searchInput  = $('searchInput');
const searchClear  = $('searchClear');
const entryList    = $('entryList');
const toolbar      = $('toolbar');
const pagination   = $('pagination');
const topStat      = $('topStat');
const resultCount  = $('resultCount');
const perPageSel   = $('perPageSel');
const sortSel      = $('sortSel');
const loadingOverlay = $('loadingOverlay');

// Restore input values from state
searchInput.value = STATE.q;
if (STATE.q) searchClear.style.display = 'block';
perPageSel.value = STATE.perPage;
sortSel.value    = STATE.sort;

// Restore active chips
function restoreChips() {
  document.querySelectorAll('.chip[data-filter]').forEach(c => {
    c.classList.toggle('active', c.dataset.filter === STATE.filter);
  });
  document.querySelectorAll('.chip[data-family]').forEach(c => {
    c.classList.toggle('active', c.dataset.family === STATE.family);
  });
  document.querySelectorAll('.chip[data-dialect]').forEach(c => {
    c.classList.toggle('active', c.dataset.dialect === STATE.dialect);
  });
  $('optInherited').checked = STATE.inherited;
}
restoreChips();

// ── STATS ─────────────────────────────────────────────────────────────────────
fetch(API_BASE + '?stats=1')
  .then(r => r.json())
  .then(s => {
    $('statTotal').textContent = s.total.toLocaleString();
    $('statShina').textContent = s.with_shina.toLocaleString();
    $('statForms').textContent = s.shina_forms.toLocaleString();
  })
  .catch(() => {});

// ── FETCH ENTRIES ─────────────────────────────────────────────────────────────
let fetchController = null;
let searchTimer     = null;

function buildParams() {
  const p = new URLSearchParams({
    q:        STATE.q,
    filter:   STATE.filter,
    family:   STATE.family,
    dialect:  STATE.dialect,
    sort:     STATE.sort,
    page:     STATE.page,
    per_page: STATE.perPage,
  });
  if (STATE.inherited) p.set('inherited', '1');
  return p;
}

async function loadEntries() {
  if (fetchController) fetchController.abort();
  fetchController = new AbortController();

  loadingOverlay.classList.add('active');
  toolbar.style.display    = 'none';
  pagination.style.display = 'none';

  const params = buildParams();
  history.replaceState(null, '', '?' + params.toString());

  try {
    const r    = await fetch(API_BASE + '?' + params.toString(), { signal: fetchController.signal });
    const data = await r.json();
    loadingOverlay.classList.remove('active');
    renderEntries(data);
  } catch(e) {
    if (e.name !== 'AbortError') {
      loadingOverlay.classList.remove('active');
      entryList.innerHTML = `<div class="empty-state"><h2>Error loading data</h2><p>${e.message}</p></div>`;
    }
  }
}

// ── RENDER ENTRIES ───────────────────────────────────────────────────────────
function renderEntries(data) {
  const { entries, total, page, per_page, total_pages } = data;

  $('statResults').textContent = total.toLocaleString();
  topStat.innerHTML = `<strong>${total.toLocaleString()}</strong> entries found`;
  resultCount.innerHTML = `Showing <strong>${entries.length}</strong> of <strong>${total.toLocaleString()}</strong> entries`;
  toolbar.style.display = 'flex';

  if (entries.length === 0) {
    entryList.innerHTML = `<div class="empty-state"><h2>No results</h2><p>Try a different search or filter.</p></div>`;
    pagination.style.display = 'none';
    return;
  }

  entryList.innerHTML = entries.map(e => renderCard(e)).join('');

  entryList.querySelectorAll('.entry-head').forEach(h => {
    h.addEventListener('click', () => {
      const card = h.closest('.entry-card');
      card.classList.toggle('expanded');
      if (card.classList.contains('expanded') && !card.dataset.rendered) {
        card.dataset.rendered = '1';
        initTabs(card);
      }
    });
  });

  renderPagination(page, total_pages);
}

function renderCard(e) {
  const shinaBadge  = e.has_shina ? `<span class="shina-badge">✦ SHINA</span>` : '';
  const genderBadge = e.headword_gender ? `<span class="hw-gender">${esc(e.headword_gender)}</span>` : '';
  const gloss       = e.headword_gloss  ? `<span class="hw-gloss">${esc(e.headword_gloss)}</span>` : '';

  let compactShina = '';
  if (e.has_shina && e.attestations) {
    const pills = [];
    for (const att of e.attestations) {
      if (!att.is_shina) continue;
      if (att.dialects && att.dialects.length) {
        for (const d of att.dialects)
          for (const f of (d.forms || []))
            pills.push(`<span class="c-form"><span class="c-dialect">${esc(d.abbv)}</span>${esc(f.form)}</span>`);
      } else {
        for (const f of (att.forms || []))
          pills.push(`<span class="c-form">${esc(f.form)}</span>`);
      }
    }
    if (pills.length)
      compactShina = `<div class="entry-compact"><div class="compact-shina-forms">${pills.join('')}</div></div>`;
  }

  return `
<div class="entry-card ${e.has_shina ? 'has-shina' : ''}" data-id="${e.id}">
  <div class="entry-head">
    <span class="entry-num">#${e.entry_num}</span>
    <span class="headword">${esc(e.headword)}</span>
    ${genderBadge}${gloss}${shinaBadge}
    <span class="expand-toggle">⌄</span>
  </div>
  ${compactShina}
  <div class="entry-body" id="body-${e.id}">
    <div style="padding:8px 0;font-size:13px;color:var(--text3);font-family:system-ui,sans-serif">Loading…</div>
  </div>
</div>`;
}

// ── LAZY TAB LOADER ──────────────────────────────────────────────────────────
function initTabs(card) {
  const id   = card.dataset.id;
  const body = card.querySelector('.entry-body');
  fetch(`${API_BASE}?id=${id}`)
    .then(r => r.json())
    .then(e => { body.innerHTML = buildEntryBody(e); attachTabLogic(body); })
    .catch(() => { body.innerHTML = `<div class="empty-state"><p>Failed to load entry.</p></div>`; });
}

function buildEntryBody(e) {
  const attByFamily = {};
  for (const att of (e.attestations || [])) {
    const fam = att.family || 'Other';
    if (!attByFamily[fam]) attByFamily[fam] = [];
    attByFamily[fam].push(att);
  }

  const shinaAtts = (e.attestations || []).filter(a => a.is_shina);
  let shinaTab = '';

  if (shinaAtts.length) {
    shinaTab = shinaAtts.map(att => {
      const inheritedTag = att.gloss_inherited
        ? `<span class="inherited-label">inherited: ${esc(att.inherited_gloss)}</span>` : '';

      if (att.dialects && att.dialects.length) {
        const rows = att.dialects.map(d => {
          const abbvName = DIALECT_NAMES[d.abbv] || d.lang_name;
          const pills = (d.forms || []).map(f =>
            `<span class="d-pill">${esc(f.form)}${f.gender ? `<span class="g">${esc(f.gender)}</span>` : ''}${f.gloss ? `<span class="gl">${esc(f.gloss)}</span>` : ''}</span>`
          ).join('');
          return `<div class="dialect-row">
            <div class="dialect-name">${esc(abbvName)} <span class="dialect-abbv">${esc(d.abbv)}</span></div>
            <div class="d-forms">${pills || '<span class="no-forms-note">see raw text</span>'}</div>
          </div>`;
        }).join('');
        return `<div class="shina-block">
          <div class="shina-block-title">✦ Shina ${inheritedTag}</div>
          ${rows}
        </div>`;
      } else {
        const pills = (att.forms || []).map(f =>
          `<span class="d-pill">${esc(f.form)}${f.gender ? `<span class="g">${esc(f.gender)}</span>` : ''}${f.gloss ? `<span class="gl">${esc(f.gloss)}</span>` : ''}</span>`
        ).join('');
        return `<div class="shina-block">
          <div class="shina-block-title">✦ Shina ${inheritedTag}</div>
          <div class="d-forms">${pills || `<span class="no-forms-note">${esc(att.raw_text)}</span>`}</div>
        </div>`;
      }
    }).join('');
  }

  const familyOrder = ['Dardic','Kafiri','NIA','MIA','OIA','Iranian','Other'];
  let allLangsHTML = '';
  for (const fam of familyOrder) {
    const atts = attByFamily[fam];
    if (!atts) continue;
    const rows = atts.map(att => {
      const cls  = FAMILY_CLASS[fam] || 'lb-other';
      const pills = (att.forms || []).map(f =>
        `<span class="form-pill">${esc(f.form)}${f.gender ? `<span class="g">${f.gender}</span>` : ''}${f.gloss ? `<span class="gl">${esc(f.gloss)}</span>` : ''}</span>`
      ).join('');
      const content = pills
        ? `<div class="form-pills">${pills}</div>`
        : (att.raw_text ? `<span class="raw-text-val">${esc(att.raw_text)}</span>` : '<span class="no-form">—</span>');
      return `<div class="lang-row">
        <div><span class="lang-badge ${cls}">${esc(att.abbv)}</span></div>
        <div>${content}</div>
      </div>`;
    }).join('');
    allLangsHTML += `<div class="lang-section">
      <div class="lang-family-head">${fam}</div>
      ${rows}
    </div>`;
  }

  const etymLine = (STATE.showEtym && e.etymology)
    ? `<div class="etym-line">< ${esc(e.etymology)}</div>` : '';

  const xrefs = e.cross_refs
    ? `<div class="xref-list">${e.cross_refs.split(/[,;\n]+/).filter(Boolean).map(x =>
        `<button class="xref-link" onclick="searchFor('${esc(x.trim())}')">${esc(x.trim())}</button>`
      ).join('')}</div>` : '<span class="no-form">None</span>';

  const tabShina       = shinaAtts.length ? `<div class="tab active" data-tab="shina">Shina (${shinaAtts.length})</div>` : '';
  const activeIfNoShina = shinaAtts.length ? '' : ' active';

  return `
    ${etymLine}
    <div class="tabs">
      ${tabShina}
      <div class="tab${activeIfNoShina}" data-tab="all">All Languages</div>
      <div class="tab" data-tab="raw">Raw Text</div>
      <div class="tab" data-tab="refs">Cross-refs</div>
    </div>
    ${shinaAtts.length ? `<div class="tab-panel active" data-panel="shina">${shinaTab}</div>` : ''}
    <div class="tab-panel${activeIfNoShina}" data-panel="all">${allLangsHTML}</div>
    <div class="tab-panel" data-panel="raw"><div class="raw-block">${esc(e.attestation_raw || '')}${e.addenda ? '\n\n[Addenda]\n' + esc(e.addenda) : ''}</div></div>
    <div class="tab-panel" data-panel="refs">${xrefs}</div>
  `;
}

function attachTabLogic(body) {
  body.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      const panel = t.dataset.tab;
      body.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      body.querySelectorAll('.tab-panel').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      body.querySelector(`[data-panel="${panel}"]`)?.classList.add('active');
    });
  });
}

// ── PAGINATION ────────────────────────────────────────────────────────────────
function renderPagination(current, total) {
  if (total <= 1) { pagination.style.display = 'none'; return; }
  pagination.style.display = 'flex';

  const pages = new Set([1]);
  for (let i = Math.max(2, current - 2); i <= Math.min(total - 1, current + 2); i++) pages.add(i);
  pages.add(total);
  const deduped = [...pages].sort((a, b) => a - b);

  let html = `<button class="page-btn" ${current === 1 ? 'disabled' : ''} onclick="goPage(${current - 1})">← Prev</button>`;
  let prev = 0;
  for (const p of deduped) {
    if (p - prev > 1) html += `<span class="page-ellipsis">…</span>`;
    html += `<button class="page-num-btn ${p === current ? 'current' : ''}" onclick="goPage(${p})">${p}</button>`;
    prev = p;
  }
  html += `<button class="page-btn" ${current === total ? 'disabled' : ''} onclick="goPage(${current + 1})">Next →</button>`;
  html += `<span class="page-info">${current} / ${total}</span>`;
  pagination.innerHTML = html;
}

function goPage(p) {
  STATE.page = p;
  loadEntries();
  document.querySelector('.main').scrollTo(0, 0);
}

// ── CONTROLS ─────────────────────────────────────────────────────────────────
function searchFor(q) {
  STATE.q = q;
  STATE.page = 1;
  searchInput.value = q;
  searchClear.style.display = 'block';
  loadEntries();
}

document.querySelectorAll('.chip[data-filter]').forEach(c => c.addEventListener('click', () => {
  document.querySelectorAll('.chip[data-filter]').forEach(x => x.classList.remove('active'));
  c.classList.add('active');
  STATE.filter = c.dataset.filter; STATE.page = 1; loadEntries();
}));

document.querySelectorAll('.chip[data-family]').forEach(c => c.addEventListener('click', () => {
  document.querySelectorAll('.chip[data-family]').forEach(x => x.classList.remove('active'));
  c.classList.add('active');
  STATE.family = c.dataset.family; STATE.page = 1; loadEntries();
}));

document.querySelectorAll('.chip[data-dialect]').forEach(c => c.addEventListener('click', () => {
  document.querySelectorAll('.chip[data-dialect]').forEach(x => x.classList.remove('active'));
  c.classList.add('active');
  STATE.dialect = c.dataset.dialect; STATE.page = 1; loadEntries();
}));

$('optInherited').addEventListener('change', e => { STATE.inherited = e.target.checked; STATE.page = 1; loadEntries(); });
$('optShowEtym').addEventListener('change',  e => { STATE.showEtym = e.target.checked; });
$('optCollapseOther').addEventListener('change', e => { STATE.collapseOther = e.target.checked; });

let searchTimer2 = null;
searchInput.addEventListener('input', () => {
  searchClear.style.display = searchInput.value ? 'block' : 'none';
  clearTimeout(searchTimer2);
  searchTimer2 = setTimeout(() => {
    STATE.q = searchInput.value.trim();
    STATE.page = 1;
    loadEntries();
  }, 320);
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.style.display = 'none';
  STATE.q = ''; STATE.page = 1; loadEntries();
});

sortSel.addEventListener('change', () => { STATE.sort = sortSel.value; STATE.page = 1; loadEntries(); });
perPageSel.addEventListener('change', () => { STATE.perPage = parseInt(perPageSel.value); STATE.page = 1; loadEntries(); });

// ── UTILS ─────────────────────────────────────────────────────────────────────
function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ── BOOT ──────────────────────────────────────────────────────────────────────
loadEntries();
