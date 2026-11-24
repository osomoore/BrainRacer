'use strict';

const catalog = window.reviewCatalog;
const storageKey = 'adventure-workshop.art-review.v1';
const onlyKey = 'adventure-workshop.art-review.changed-only';
const el = (id) => document.getElementById(id);
const workshop = el('workshop');
const aspect = el('aspect');
const buttons = el('variants');
const comment = el('comment');
const status = el('message');
const only = el('only-changed');
const grades = [...document.querySelectorAll('input[name="grade"]')];
const items = catalog.flatMap((shop) => shop.aspects.flatMap((part) => part.variants.map((variant, index) => ({
  shop, part, variant, index, key: shop.id + '/' + variant.id,
}))));
let reports = {};
try { reports = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch {}
try { only.checked = localStorage.getItem(onlyKey) === '1'; } catch {}
let active;

const hasFeedback = (report) => Boolean(report && (report.grade || report.comment));
/** Graded before, but the picture differs now. Reports saved before fingerprints existed have no hash and count as changed. */
const isChanged = (item) => hasFeedback(reports[item.key]) && Boolean(item.variant.hash) && reports[item.key].hash !== item.variant.hash;
const needsReview = (item) => !hasFeedback(reports[item.key]) || isChanged(item);
/** The lists show everything, or only what needs review (plus the variant being edited, so it doesn't vanish mid-edit). */
const listed = (item) => !only.checked || needsReview(item) || item === active;

function fillSelect(select, records, label) {
  select.replaceChildren(...records.map((record) => new Option(label(record), record.id)));
}

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(reports));
    return true;
  } catch {
    return false;
  }
}

function refreshProgress() {
  const pending = items.filter(needsReview).length;
  const changed = items.filter(isChanged).length;
  el('progress').textContent = only.checked
    ? pending + ' to review of ' + items.length
    : items.filter((item) => reports[item.key]).length + ' of ' + items.length + ' reviewed' + (changed ? ' · ' + changed + ' changed since graded' : '');
  for (const button of buttons.children) {
    const item = items.find((other) => other.key === button.dataset.key);
    const report = reports[item.key];
    const mark = report?.grade ? report.grade + '/5' : report ? '•' : '';
    button.lastElementChild.textContent = (isChanged(item) ? 'changed ' : '') + mark;
  }
  const note = el('changed-note');
  note.hidden = !(active && isChanged(active));
  if (!note.hidden) {
    const old = reports[active.key];
    el('changed-text').textContent = 'This picture changed since you graded it. Your earlier feedback: '
      + [old.grade ? old.grade + '/5' : '', old.comment ? '“' + old.comment + '”' : ''].filter(Boolean).join(' ') + '.';
  }
  const shop = catalog.find((other) => other.id === workshop.value);
  for (const option of aspect.options) {
    const part = shop?.aspects.find((other) => other.id === option.value);
    if (!part) continue;
    const left = items.filter((item) => item.part === part && needsReview(item)).length;
    option.textContent = part.label + (left ? ' (' + left + ' to review)' : '');
  }
}

function save() {
  const grade = Number(grades.find((input) => input.checked)?.value || 0);
  if (grade || comment.value.trim()) reports[active.key] = { grade: grade || null, comment: comment.value.trim(), hash: active.variant.hash };
  else delete reports[active.key];
  status.textContent = persist() ? 'Saved in this browser.' : 'Local storage is unavailable. Copy or download your feedback before closing.';
  refreshProgress();
}

function preview(item, source, label, start, end) {
  const cols = Math.max(3, item.part.variants.length);
  const bandHeight = end - start;
  const figure = document.createElement('figure');
  const caption = document.createElement('figcaption');
  caption.textContent = label;
  const clip = document.createElement('a');
  clip.className = 'crop';
  clip.href = source;
  clip.target = '_blank';
  clip.rel = 'noopener';
  clip.style.aspectRatio = (1920 / cols) + ' / ' + bandHeight;
  const image = document.createElement('img');
  image.src = source;
  image.alt = item.variant.name + ', ' + label.toLowerCase() + ' view';
  image.style.width = cols * 100 + '%';
  image.style.left = -item.index * 100 + '%';
  image.style.top = -start / bandHeight * 100 + '%';
  clip.append(image);
  figure.append(caption, clip);
  return figure;
}

function show(item) {
  active = item;
  el('empty').hidden = true;
  const pendingIn = (test) => items.some((other) => test(other) && needsReview(other));
  fillSelect(workshop, catalog.filter((shop) => shop === item.shop || !only.checked || pendingIn((other) => other.shop === shop)), (shop) => shop.title);
  workshop.value = item.shop.id;
  fillSelect(aspect, item.shop.aspects.filter((part) => part === item.part || !only.checked || pendingIn((other) => other.part === part)), (part) => part.label);
  aspect.value = item.part.id;
  buttons.replaceChildren();
  items.filter((other) => other.shop === item.shop && other.part === item.part && listed(other)).forEach((other) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.key = other.key;
    const title = document.createElement('span');
    title.textContent = other.variant.name;
    button.append(title, document.createElement('span'));
    button.setAttribute('aria-current', String(other.key === item.key));
    button.onclick = () => { show(other); buttons.querySelector('[aria-current=true]').focus(); };
    buttons.append(button);
  });
  el('title').textContent = item.variant.name;
  const source = item.part.sheet || 'shots/grade-' + item.shop.id + '-' + item.part.id + '.png';
  el('sheet').href = source;
  const views = [preview(item, source, 'Side', 115, 514)];
  if (item.shop.id === 'dino' && item.part.id === 'size' && item.variant.id !== 'size.medium') {
    const reference = items.find((other) => other.shop === item.shop && other.variant.id === 'size.medium');
    views.push(preview(reference, source, 'Medium for scale', 115, 514));
  }
  if (item.part.top || item.variant.id === 'teeth.beak') views.push(preview(item, source, 'Top', 625, 942));
  el('views').replaceChildren(...views);
  const report = reports[item.key];
  grades.forEach((input) => { input.checked = Number(input.value) === report?.grade; });
  comment.value = report?.comment || '';
  el('manual-copy').hidden = true;
  status.textContent = '';
  el('editor').hidden = false;
  refreshProgress();
}

function showEmpty() {
  active = undefined;
  el('editor').hidden = true;
  el('empty').hidden = false;
  buttons.replaceChildren();
  fillSelect(workshop, catalog, (shop) => shop.title);
  fillSelect(aspect, [], () => '');
  refreshProgress();
}

/** Export rows keep the long-standing shape; the hash stays internal. */
function reviewed() {
  return items.filter((item) => reports[item.key]).map((item) => ({
    workshop: item.shop.id,
    aspect: item.part.id,
    variant: item.variant.id,
    name: item.variant.name,
    grade: reports[item.key].grade ?? null,
    comment: reports[item.key].comment ?? '',
  }));
}

const firstIn = (match) => items.find((item) => match(item) && needsReview(item)) || items.find(match);
workshop.onchange = () => show(firstIn((item) => item.shop.id === workshop.value));
aspect.onchange = () => show(firstIn((item) => item.shop.id === workshop.value && item.part.id === aspect.value));
only.onchange = () => {
  try { localStorage.setItem(onlyKey, only.checked ? '1' : '0'); } catch {}
  const current = active;
  active = undefined;
  if (!only.checked) show(current || items[0]);
  else {
    const target = current && needsReview(current) ? current
      : items.find((item) => current && item.part === current.part && item.shop === current.shop && needsReview(item)) || items.find(needsReview);
    if (target) show(target);
    else showEmpty();
  }
};
el('show-all').onclick = () => { only.checked = false; only.onchange(); };
comment.oninput = save;
grades.forEach((input) => { input.onchange = save; });
el('clear').onclick = () => {
  grades.forEach((input) => { input.checked = false; });
  comment.value = '';
  save();
  status.textContent = 'Review cleared.';
};
el('still-good').onclick = () => {
  reports[active.key] = { ...reports[active.key], hash: active.variant.hash };
  persist();
  status.textContent = 'Marked as still good; it will not show as changed again.';
  refreshProgress();
};
el('baseline').onclick = () => {
  if (!confirm('Treat everything you have already graded as up to date? Only future picture changes will show as changed.')) return;
  for (const item of items) if (hasFeedback(reports[item.key]) && item.variant.hash) reports[item.key].hash = item.variant.hash;
  persist();
  if (active) { show(active); status.textContent = 'Everything graded so far is now up to date.'; }
  else if (only.checked && !items.some(needsReview)) showEmpty();
};
el('next').onclick = () => {
  const index = items.indexOf(active);
  const next = [...items.slice(index + 1), ...items.slice(0, index)].find(needsReview);
  if (next) show(next);
  else if (only.checked && !needsReview(active)) showEmpty();
  else status.textContent = needsReview(active) ? 'This is the last variant left to review.' : 'Nothing left to review.';
};
el('copy').onclick = async () => {
  const rows = reviewed();
  if (!rows.length) { status.textContent = 'There’s no feedback to copy yet.'; return; }
  const feedback = rows.map((row) => [
    '- ' + (row.workshop === 'dino' ? 'Dino Lab' : 'Race Shop') + ' / ' + row.name + ' (' + row.variant + ')',
    row.grade ? row.grade + '/5' : '',
    row.comment,
  ].filter(Boolean).join(' — ')).join('\n');
  try {
    await navigator.clipboard.writeText(feedback);
    status.textContent = 'Feedback copied. Paste it into chat.';
  } catch {
    const manual = el('manual-copy');
    manual.hidden = false;
    manual.value = feedback;
    manual.focus();
    manual.select();
    status.textContent = 'Press Ctrl+C to copy the selected feedback.';
  }
};
el('download').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(reviewed(), null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'workshop-art-feedback.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
function begin() {
  const requested = new URLSearchParams(location.search).get('part');
  const start = items.find((item) => item.shop.id === 'dino' && item.part.id === requested);
  if (only.checked && !start) {
    const first = items.find(needsReview);
    if (first) show(first);
    else showEmpty();
  } else show(start || items[0]);
}
/** Grades saved before fingerprints existed get the hash of the art they were graded against (baseline-hashes.json), so only really-changed art shows as changed. */
fetch('baseline-hashes.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((base) => {
  let filled = false;
  for (const [key, report] of Object.entries(reports)) {
    if (hasFeedback(report) && !report.hash && base[key]) { report.hash = base[key]; filled = true; }
  }
  if (filled) persist();
  begin();
});
