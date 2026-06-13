// ── STATE ──
let ALL_ENTRIES = [];
let filtered = [];
let currentPage = 1;
const PER_PAGE = 25;

let state = {
  query: '',
  filterMode: 'all',     // all | shina
  family: 'all',
  dialect: 'all',
  inherited: false,
  showEtym: true,
  collapseOther: false,
};

const DIALECT_NAMES = {
  'gil.': 'Gilgiti', 'koh.': 'Kohistani', 'gur.': 'Guresi',
  'pales.': 'Palesi', 'bro.': 'Brokpa', 'jij.': 'Jijelut',
  'punl.': 'Puniali', 'chil.': 'Chilasi', 'dr.': 'Dras',
  'kōl.': 'Kola', 'Sh.': 'General'
};

const FAMILY_CLASS = {
  'NIA': 'lb-nia', 'MIA': 'lb-mia', 'OIA': 'lb-oia',
  'Dardic': 'lb-dardic', 'Kafiri': 'lb-kafiri',
  'Iranian': 'lb-iranian'
};

// ── LOAD DATA ──
async function tryAutoLoad() {
  const main = document.getElementById('main');
  
  // Production paths for your GitHub repository structure
  const jsonPaths = [
    'data/cdial_full.json',
    'cdial_full.json',
    'data/cdial_shina.json',
    'cdial_shina.json'
  ];

  for (const path of jsonPaths) {
    try {
      logLoadingStatus(`Fetching ${path}...`);
      const r = await fetch(path);
      if (r.ok) {
        logLoadingStatus("Parsing dictionary database...");
        const data = await r.json();
        if (Array.isArray(data) && data.length > 0) {
          initData(data);
          return;
        }
      }
    } catch(e) {
      console.warn(`Failed asset fetch at path: ${path}`, e);
    }
  }

  // Fallback layout when hosted files are missing from GitHub
  main.innerHTML = `
    <div class="empty-state">
      <div style="font-size:40px;margin-bottom:16px">⚠️</div>
      <h2>Data Source Not Found</h2>
      <p>Could not automatically fetch the CDIAL dataset records.</p>
      <div style="font-size:13px;color:var(--text3);margin-top:12px;background:rgba(0,0,0,0.03);padding:12px;border-radius:6px;max-width:460px;display:inline-block;text-align:left;line-height:1.4;">
        <strong>GitHub Pages Deployment Check:</strong><br>
        1. Verify <code>cdial_full.json</code> or <code>cdial_shina.json</code> is committed.<br>
        2. Ensure the files are inside a <code>data/</code> directory or directly in the root of your main repository branch.
      </div>
    </div>
  `;
}

function logLoadingStatus(message) {
  const msgDiv = document.getElementById('loadingMsg');
  if (msgDiv) {
    let label = msgDiv.querySelector('.status-label');
    if (!label) {
      label = document.createElement('div');
      label.className = 'status-label';
      label.style.cssText = "font-size:13px; margin-top:8px; color:var(--text2); font-weight:500;";
      msgDiv.appendChild(label);
    }
    label.textContent = message;
  }
}

function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (Array.isArray(data)) initData(data);
      else if (data.entries) initData(data.entries);
    } catch(err) {
      alert('Could not parse JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function initData(data) {
  ALL_ENTRIES = data;
  // Count Shina forms
  let shinaForms = 0;
  ALL_ENTRIES.forEach(e => {
    (e.attestations || []).forEach(a => {
      if (a.is_shina) {
        if (a.dialects) a.dialects.forEach(d => shinaForms += (d.forms || []).length);
        else shinaForms += (a.forms || []).length;
      }
    });
  });
  const shinaCount = ALL_ENTRIES.filter(e => e.has_shina).length;
  document.getElementById('statTotal').textContent = ALL_ENTRIES.length.toLocaleString();
  document.getElementById('statShina').textContent = shinaCount.toLocaleString();
  document.getElementById('statForms').textContent = shinaForms.toLocaleString();
  document.getElementById('topStat').innerHTML = `<strong>${ALL_ENTRIES.length.toLocaleString()}</strong> entries loaded`;
  applyFilters();
}

// ── SEARCH + FILTER ──
function applyFilters() {
  const q = state.query.toLowerCase().trim();
  filtered = ALL_ENTRIES.filter(entry => {
    if (state.filterMode === 'shina' && !entry.has_shina) return false;
    if (state.inherited) {
      const hasInherited = (entry.attestations || []).some(a => a.gloss_inherited && a.is_shina);
      if (!hasInherited) return false;
    }
    if (state.family !== 'all') {
      const has = (entry.attestations || []).some(a => a.family === state.family);
      if (!has) return false;
    }
    if (state.dialect !== 'all') {
      let has = false;
      (entry.attestations || []).forEach(a => {
        if (a.dialects) a.dialects.forEach(d => { if (d.abbv === state.dialect) has = true; });
        else if (a.abbv === state.dialect) has = true;
      });
      if (!has) return false;
    }
    if (!q) return true;
    // Search headword
    if ((entry.headword || '').toLowerCase().includes(q)) return true;
    // Search gloss
    if ((entry.headword_gloss || '').toLowerCase().includes(q)) return true;
    // Search etymology
    if ((entry.etymology || '').toLowerCase().includes(q)) return true;
    // Search attestation forms and glosses
    for (const a of (entry.attestations || [])) {
      if ((a.raw_text || '').toLowerCase().includes(q)) return true;
      const forms = a.dialects ? a.dialects.flatMap(d => d.forms || []) : (a.forms || []);
      for (const f of forms) {
        if ((f.form || '').toLowerCase().includes(q)) return true;
        if ((f.gloss || '').toLowerCase().includes(q)) return true;
      }
    }
    return false;
  });
  currentPage = 1;
  document.getElementById('statResults').textContent = filtered.length.toLocaleString();
  render();
}

function hl(text, q) {
  if (!q || !text) return esc(text || '');
  const regex = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return esc(text).replace(regex, '<mark>$1</mark>');
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── RENDER ──
function render() {
  const main = document.getElementById('main');
  const q = state.query.toLowerCase().trim();

  if (!ALL_ENTRIES.length) return;
  if (filtered.length === 0) {
    main.innerHTML = `<div class="empty-state"><h2>No results</h2><p>Try a different search term or adjust the filters.</p></div>`;
    return;
  }

  const start = (currentPage - 1) * PER_PAGE;
  const page = filtered.slice(start, start + PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  let html = `<div class="toolbar">
    <div class="result-count"><strong>${filtered.length.toLocaleString()}</strong> results${q ? ` for "<strong>${esc(q)}</strong>"` : ''}</div>
    <select class="sort-sel" id="sortSel">
      <option value="num">Sort: entry number</option>
      <option value="az">Sort: headword A–Z</option>
      <option value="shina">Sort: Shina forms ↓</option>
    </select>
    <button class="export-btn" onclick="exportCSV()">Export CSV</button>
  </div>`;

  page.forEach(entry => { html += renderCard(entry, q); });

  // Pagination
  if (totalPages > 1) {
    html += `<div class="pagination">
      <button class="page-btn" onclick="goPage(${currentPage-1})" ${currentPage===1?'disabled':''}>← Prev</button>
      <span class="page-info">Page ${currentPage} of ${totalPages}</span>
      <button class="page-btn" onclick="goPage(${currentPage+1})" ${currentPage===totalPages?'disabled':''}>Next →</button>
    </div>`;
  }

  main.innerHTML = html;

  // Restore sort
  const sel = document.getElementById('sortSel');
  if (sel) {
    sel.value = window._sortMode || 'num';
    sel.addEventListener('change', e => {
      window._sortMode = e.target.value;
      sortFiltered(e.target.value);
      currentPage = 1;
      render();
    });
  }
}

function renderCard(entry, q) {
  const shinaBadge = entry.has_shina ? `<span class="shina-badge">✦ SHINA</span>` : '';
  const genderBadge = entry.headword_gender ? `<span class="hw-gender">${esc(entry.headword_gender)}.</span>` : '';

  // Compact Shina forms for collapsed view
  let compactShina = '';
  if (entry.has_shina) {
    const shinaAtts = (entry.attestations||[]).filter(a=>a.is_shina);
    let pills = '';
    shinaAtts.forEach(a => {
      const dialects = a.dialects || [{abbv: a.abbv, lang_name: a.lang_name, forms: a.forms}];
      dialects.slice(0,5).forEach(d => {
        (d.forms||[]).slice(0,2).forEach(f => {
          if (f.form && f.form.length < 30) {
            pills += `<span class="c-form"><span class="c-dialect">${esc(d.abbv||'')}</span>${hl(f.form,q)}</span>`;
          }
        });
      });
    });
    if (pills) compactShina = `<div class="entry-compact"><div class="compact-shina-forms">${pills}</div></div>`;
  }

  return `<div class="entry-card ${entry.has_shina?'has-shina':''}" id="card-${entry.entry_num}">
    <div class="entry-head" onclick="toggleCard(${entry.entry_num})">
      <span class="entry-num">#${entry.entry_num}</span>
      <span class="headword">${hl(entry.headword||'',q)}</span>
      ${genderBadge}
      <span class="hw-gloss">'${hl(entry.headword_gloss||'',q)}'</span>
      ${shinaBadge}
      <span class="expand-toggle">⌄</span>
    </div>
    ${compactShina}
    <div class="entry-body">
      ${state.showEtym && entry.etymology ? `<div class="etym-line">Etymology: ${esc(entry.etymology)}</div>` : ''}
      <div class="tabs">
        ${entry.has_shina ? `<div class="tab active" onclick="switchTab(event,${entry.entry_num},'shina')">Shina</div>` : ''}
        <div class="tab ${!entry.has_shina?'active':''}" onclick="switchTab(event,${entry.entry_num},'all')">All languages</div>
        <div class="tab" onclick="switchTab(event,${entry.entry_num},'raw')">Raw text</div>
        ${entry.cross_refs ? `<div class="tab" onclick="switchTab(event,${entry.entry_num},'xref')">Cross-refs</div>` : ''}
      </div>
      ${entry.has_shina ? renderShinaPanel(entry, q) : ''}
      ${renderAllPanel(entry, q, !entry.has_shina)}
      ${renderRawPanel(entry)}
      ${entry.cross_refs ? renderXrefPanel(entry) : ''}
    </div>
  </div>`;
}

function renderShinaPanel(entry, q) {
  const shinaAtts = (entry.attestations||[]).filter(a=>a.is_shina);
  let html = `<div class="tab-panel active" data-tab="shina" data-entry="${entry.entry_num}">`;
  shinaAtts.forEach(a => {
    const inh = a.gloss_inherited && a.inherited_gloss;
    html += `<div class="shina-block">
      <div class="shina-block-title">
        ✦ Shina attestations
        ${inh ? `<span class="inherited-label">inherited: '${esc(a.inherited_gloss)}'</span>` : ''}
      </div>`;
    const dialects = a.dialects || [{abbv:a.abbv, lang_name:a.lang_name, forms:a.forms, raw_text:a.raw_text}];
    dialects.forEach(d => {
      const dName = DIALECT_NAMES[d.abbv] || d.lang_name || d.abbv;
      const forms = (d.forms||[]);
      html += `<div class="dialect-row">
        <div class="dialect-name">${esc(dName)} <span class="dialect-abbv">${esc(d.abbv||'')}</span></div>
        <div class="d-forms">`;
      if (forms.length === 0 && d.raw_text) {
        html += `<span class="no-forms-note">${esc(d.raw_text.slice(0,80))}</span>`;
      } else if (forms.length === 0) {
        html += `<span class="no-forms-note">—</span>`;
      } else {
        forms.forEach(f => {
          if (!f.form || f.form.length > 60) return;
          const genderStr = f.gender ? `<span class="g">${esc(f.gender)}.</span>` : '';
          const glossStr = f.gloss ? `<span class="gl">'${hl(f.gloss, q)}'</span>` : '';
          html += `<span class="d-pill">${hl(f.form,q)}${genderStr}${glossStr}</span>`;
        });
      }
      html += `</div></div>`;
    });
    html += `</div>`;
  });
  html += `</div>`;
  return html;
}

function renderAllPanel(entry, q, active) {
  const atts = entry.attestations || [];
  if (!atts.length) return `<div class="tab-panel ${active?'active':''}" data-tab="all" data-entry="${entry.entry_num}"><div class="no-form">No attestations recorded.</div></div>`;

  // Group by family
  const byFamily = {};
  atts.forEach(a => {
    if (state.collapseOther && !a.is_shina) return;
    const fam = a.family || 'Other';
    if (!byFamily[fam]) byFamily[fam] = [];
    byFamily[fam].push(a);
  });

  let html = `<div class="tab-panel ${active?'active':''}" data-tab="all" data-entry="${entry.entry_num}">`;
  const famOrder = ['OIA','MIA','Dardic','NIA','Kafiri','Iranian','Semitic','Dravidian','Isolate','Sino-Tibetan','Turkic','Germanic','Austro-Asiatic','Other'];
  famOrder.forEach(fam => {
    if (!byFamily[fam]) return;
    html += `<div class="lang-section">
      <div class="lang-family-head">${esc(fam)}</div>`;
    byFamily[fam].forEach(a => {
      const cls = FAMILY_CLASS[a.family] || 'lb-other';
      const forms = a.dialects ? a.dialects.flatMap(d=>d.forms||[]) : (a.forms||[]);
      html += `<div class="lang-row">
        <div><span class="lang-badge ${cls}">${esc(a.abbv)}</span></div>
        <div class="form-pills">`;
      if (forms.length === 0) {
        html += `<span class="no-form">${a.raw_text ? esc(a.raw_text.slice(0,60)) : '—'}</span>`;
      } else {
        forms.slice(0,6).forEach(f => {
          if (!f.form || f.form.length>50) return;
          const g = f.gender ? `<span class="g">${esc(f.gender)}.</span>` : '';
          const gl = f.gloss ? `<span class="gl">'${hl(f.gloss,q)}'</span>` : '';
          html += `<span class="form-pill">${hl(f.form,q)}${g}${gl}</span>`;
        });
        if (forms.length > 6) html += `<span class="no-form">+${forms.length-6} more</span>`;
      }
      html += `</div></div>`;
    });
    html += `</div>`;
  });
  html += `</div>`;
  return html;
}

function renderRawPanel(entry) {
  return `<div class="tab-panel" data-tab="raw" data-entry="${entry.entry_num}">
    <div class="raw-block">${esc(entry.attestation_raw || '(no attestation text)')}</div>
    ${entry.addenda ? `<div style="margin-top:10px"><div class="lang-family-head">Addenda</div><div class="raw-block">${esc(entry.addenda)}</div></div>` : ''}
  </div>`;
}

function renderXrefPanel(entry) {
  const refs = (entry.cross_refs||'').split(/[\s,]+/).filter(r=>r.length>2);
  let links = refs.map(r => `<button class="xref-link" onclick="searchFor('${esc(r)}')">${esc(r)}</button>`).join('');
  return `<div class="tab-panel" data-tab="xref" data-entry="${entry.entry_num}">
    <div class="xref-list">${links}</div>
  </div>`;
}

// ── INTERACTIONS ──
function toggleCard(num) {
  const card = document.getElementById('card-'+num);
  if (!card) return;
  card.classList.toggle('expanded');
}

function switchTab(e, num, tabName) {
  e.stopPropagation();
  const card = document.getElementById('card-'+num);
  if (!card) return;
  if (!card.classList.contains('expanded')) card.classList.add('expanded');
  card.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  card.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  e.target.classList.add('active');
  const panel = card.querySelector(`.tab-panel[data-tab="${tabName}"]`);
  if (panel) panel.classList.add('active');
}

function goPage(p) {
  currentPage = p;
  render();
  document.getElementById('main').scrollTop = 0;
}

function sortFiltered(mode) {
  if (mode === 'az') filtered.sort((a,b) => (a.headword||'').localeCompare(b.headword||''));
  else if (mode === 'num') filtered.sort((a,b) => a.entry_num - b.entry_num);
  else if (mode === 'shina') {
    filtered.sort((a,b) => {
      const ca = (a.attestations||[]).filter(x=>x.is_shina).length;
      const cb = (b.attestations||[]).filter(x=>x.is_shina).length;
      return cb - ca;
    });
  }
}

function searchFor(term) {
  document.getElementById('searchInput').value = term;
  state.query = term;
  document.getElementById('searchClear').style.display = 'block';
  applyFilters();
}

function exportCSV() {
  if (!filtered.length) return;
  const rows = [['entry_num','headword','headword_gloss','dialect','form','gloss','gloss_inherited']];
  filtered.forEach(entry => {
    const shinAs = (entry.attestations||[]).filter(a=>a.is_shina);
    if (shinAs.length === 0) {
      rows.push([entry.entry_num, entry.headword, entry.headword_gloss, '', '', '', '']);
    } else {
      shinAs.forEach(a => {
        const dialects = a.dialects || [{abbv:a.abbv,forms:a.forms}];
        dialects.forEach(d => {
          const forms = d.forms||[];
          if (forms.length === 0) {
            rows.push([entry.entry_num, entry.headword, entry.headword_gloss, d.abbv, '', a.inherited_gloss||'', a.gloss_inherited?'yes':'no']);
          } else {
            forms.forEach(f => {
              rows.push([entry.entry_num, entry.headword, entry.headword_gloss, d.abbv, f.form, f.gloss||a.inherited_gloss||'', a.gloss_inherited?'yes':'no']);
            });
          }
        });
      });
    }
  });
  const csv = rows.map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'cdial_export.csv';
  a.click();
}

// ── WIRE UP ──
document.getElementById('searchInput').addEventListener('input', e => {
  state.query = e.target.value;
  document.getElementById('searchClear').style.display = state.query ? 'block' : 'none';
  applyFilters();
});
document.getElementById('searchClear').addEventListener('click', () => {
  document.getElementById('searchInput').value = '';
  state.query = '';
  document.getElementById('searchClear').style.display = 'none';
  applyFilters();
});

document.querySelectorAll('[data-filter]').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach(c=>c.classList.remove('active'));
    chip.classList.add('active');
    state.filterMode = chip.dataset.filter;
    applyFilters();
  });
});

document.querySelectorAll('[data-family]').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('[data-family]').forEach(c=>c.classList.remove('active'));
    chip.classList.add('active');
    state.family = chip.dataset.family;
    applyFilters();
  });
});

document.querySelectorAll('[data-dialect]').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('[data-dialect]').forEach(c=>c.classList.remove('active'));
    chip.classList.add('active');
    state.dialect = chip.dataset.dialect;
    applyFilters();
  });
});

document.getElementById('optInherited').addEventListener('change', e => {
  state.inherited = e.target.checked;
  applyFilters();
});
document.getElementById('optShowEtym').addEventListener('change', e => {
  state.showEtym = e.target.checked;
  applyFilters();
});
document.getElementById('optCollapseOther').addEventListener('change', e => {
  state.collapseOther = e.target.checked;
  applyFilters();
});

document.getElementById('fileInput')?.addEventListener('change', handleFile);

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    document.getElementById('searchInput').focus();
  }
  if (e.key === 'Escape') document.getElementById('searchInput').blur();
});

// ── START ──
tryAutoLoad();