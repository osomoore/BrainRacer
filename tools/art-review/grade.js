'use strict';

const catalog = window.reviewCatalog;
const storageKey = 'adventure-workshop.art-review.v1';
const el = (id) => document.getElementById(id);
const workshop = el('workshop');
const aspect = el('aspect');
const buttons = el('variants');
const comment = el('comment');
const status = el('message');
const grades = [...document.querySelectorAll('input[name="grade"]')];
const items = catalog.flatMap((shop) => shop.aspects.flatMap((part) => part.variants.map((variant, index) => ({
  shop, part, variant, index, key: shop.id + '/' + variant.id,
}))));
let reports = {};
try { reports = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch {}
let active;

function fillSelect(select, records, label) {
  select.replaceChildren(...records.map((record) => new Option(label(record), record.id)));
}

function refreshProgress() {
  const count = items.filter((item) => reports[item.key]).length;
  el('progress').textContent = count + ' of ' + items.length + ' reviewed';
  for (const button of buttons.children) {
    const report = reports[button.dataset.key];
    button.lastElementChild.textContent = report?.grade ? report.grade + '/5' : report ? '•' : '';
  }
}

function save() {
  const grade = Number(grades.find((input) => input.checked)?.value || 0);
  if (grade || comment.value.trim()) reports[active.key] = { grade: grade || null, comment: comment.value.trim() };
  else delete reports[active.key];
  try {
    localStorage.setItem(storageKey, JSON.stringify(reports));
    status.textContent = 'Saved in this browser.';
  } catch {
    status.textContent = 'Local storage is unavailable. Copy or download your feedback before closing.';
  }
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
  workshop.value = item.shop.id;
  fillSelect(aspect, item.shop.aspects, (part) => part.label);
  aspect.value = item.part.id;
  buttons.replaceChildren();
  items.filter((other) => other.shop === item.shop && other.part === item.part).forEach((other) => {
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

function reviewed() {
  return items.filter((item) => reports[item.key]).map((item) => ({
    workshop: item.shop.id,
    aspect: item.part.id,
    variant: item.variant.id,
    name: item.variant.name,
    ...reports[item.key],
  }));
}

fillSelect(workshop, catalog, (shop) => shop.title);
workshop.onchange = () => show(items.find((item) => item.shop.id === workshop.value));
aspect.onchange = () => show(items.find((item) => item.shop.id === workshop.value && item.part.id === aspect.value));
comment.oninput = save;
grades.forEach((input) => { input.onchange = save; });
el('clear').onclick = () => {
  grades.forEach((input) => { input.checked = false; });
  comment.value = '';
  save();
  status.textContent = 'Review cleared.';
};
el('next').onclick = () => {
  const index = items.indexOf(active);
  const next = [...items.slice(index + 1), ...items.slice(0, index)].find((item) => !reports[item.key]);
  if (next) show(next);
  else status.textContent = reports[active.key] ? 'All variants have feedback.' : 'This is the last unreviewed variant.';
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
const requested = new URLSearchParams(location.search).get('part');
show(items.find((item) => item.shop.id === 'dino' && item.part.id === requested) || items[0]);


