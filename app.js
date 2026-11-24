// ====== ЛОКАЦИИ — цены, описания, фото карточек ======
// Сами группы (даты, места) хранятся на сервере в data/camps.json
// и меняются через Telegram-бота командами /camps, /add, /dates, /seats, /del.
const LOCATIONS = {
  kas: {
    place: 'Каш, Турция', short: 'Каш',
    title: 'Теннисный кемп у моря в Каше',
    category: 'Кемп у моря',
    priceOne: 120000, pricePair: 230000,
    note: 'перелёт отдельно',
    features: ['Вилла с бассейном', '15 ч на корте', 'Видеоразбор', 'Шеф-повар', 'Трансфер'],
    photos: ['img/gallery/03.jpg', 'img/gallery/01.jpg', 'img/gallery/05.jpg', 'img/gallery/04.jpg'],
  },
  sochi: {
    place: 'Сочи, Россия', short: 'Сочи',
    title: 'Зимний кемп на закрытых кортах',
    category: 'Зимний кемп',
    priceOne: null, pricePair: null,
    note: 'дорога отдельно',
    features: ['Закрытые корты', 'Группа до 7 человек', 'Видеоразбор'],
    photos: [],
  },
};
// ======================================================

const fmtPrice = (n) => (n == null ? 'по запросу' : n.toLocaleString('ru-RU') + ' ₽');
const d = (s) => new Date(s + 'T00:00:00');
const fmtDate = (s, opts) => d(s).toLocaleDateString('ru-RU', opts);
const fmtRange = (a, b) => d(a).getMonth() === d(b).getMonth()
  ? `${d(a).getDate()}–${fmtDate(b, { day: 'numeric', month: 'long' })}`
  : `${fmtDate(a, { day: 'numeric', month: 'long' })} – ${fmtDate(b, { day: 'numeric', month: 'long' })}`;
const monthKey = (s) => s.slice(0, 7);
const monthLabel = (s) => { const t = fmtDate(s, { month: 'long', year: 'numeric' }).replace(' г.', ''); return t[0].toUpperCase() + t.slice(1); };
const days = (a, b) => Math.round((d(b) - d(a)) / 864e5) + 1;
const daysWord = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'день' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'дня' : 'дней');
const left = (c) => Math.max(0, c.seats - c.taken);
const isSold = (c) => left(c) === 0;
const loc = (c) => LOCATIONS[c.loc] || LOCATIONS.kas;
const campLabel = (c) => `${loc(c).place} · ${fmtRange(c.start, c.end)} ${c.start.slice(0, 4)}`;

const TG_CHAT = 'https://t.me/prana_kitchen_worldwide';
// Воркер Cloudflare: принимает заявки и отдаёт расписание, когда сайт работает без своего сервера (GitHub Pages)
const WORKER_URL = 'https://tennis-camp-leads.nurutdinovaaalsu.workers.dev';
let STATIC_MODE = false; // true, если сайт открыт без сервера (например, на GitHub Pages)
let CAMPS = [];
let upcoming = [];
let currentFilter = { loc: 'all', month: 'all' };

// ---------- Карточки групп ----------
const grid = document.getElementById('campsGrid');
function renderCamps() {
  const list = upcoming.filter((c) => (currentFilter.loc === 'all' || c.loc === currentFilter.loc)
    && (currentFilter.month === 'all' || monthKey(c.start) === currentFilter.month));
  const photoIdx = {};
  grid.innerHTML = list.length ? list.map((c, i) => {
    const L = loc(c);
    photoIdx[c.loc] = (photoIdx[c.loc] ?? -1) + 1;
    const photo = L.photos.length ? L.photos[photoIdx[c.loc] % L.photos.length] : null;
    const l = left(c);
    const badges = [
      c === upcoming[0] ? '<span class="badge badge--hot">Ближайшая</span>' : '',
      isSold(c) ? '<span class="badge badge--dark">Мест нет</span>' : c.taken > 0 && l <= 3 ? `<span class="badge badge--hot">Осталось ${l}</span>` : '',
    ].join('');
    const seats = isSold(c) ? '<p class="camp__seats camp__seats--sold">Мест нет — можно в лист ожидания</p>'
      : c.taken > 0 && l <= 3 ? `<p class="camp__seats camp__seats--low">Осталось ${l} из ${c.seats} мест</p>`
      : `<p class="camp__seats">● Набор открыт · до ${c.seats} человек</p>`;
    const price = L.priceOne == null
      ? 'Цена <b>по запросу</b>'
      : `От <b>${fmtPrice(L.priceOne)}</b><small>пара — ${fmtPrice(L.pricePair)}</small>`;
    const n = days(c.start, c.end);
    return `
    <button class="camp ${isSold(c) ? 'is-sold' : ''}" data-apply="${c.id}" style="animation-delay:${i * 50}ms" aria-label="${L.title}, ${fmtRange(c.start, c.end)}">
      <div class="camp__img ${photo ? '' : 'camp__img--winter'}" ${photo ? `style="--img:url('${photo}')"` : ''}>
        ${photo ? '' : '<span class="snow" aria-hidden="true"></span>'}
        <div class="camp__badges">${badges}</div>
      </div>
      <div class="camp__body">
        <p class="camp__cat">${L.category}</p>
        <h3 class="camp__title">${L.title}</h3>
        <p class="camp__row"><svg><use href="#i-pin"/></svg>${L.place}</p>
        <p class="camp__row"><svg><use href="#i-cal"/></svg>${fmtRange(c.start, c.end)} ${c.start.slice(0, 4)} · ${n} ${daysWord(n)}</p>
        <ul class="camp__features">${L.features.map((f) => `<li>${f}</li>`).join('')}</ul>
        ${seats}
        <div class="camp__foot"><div class="camp__price">${price}</div></div>
      </div>
    </button>`;
  }).join('') : '<p class="muted">На эти даты групп пока нет — <button class="link-btn" data-apply="undecided">оставьте заявку</button>, и мы сообщим о новых датах первыми.</p>';
}

function setFilter(locKey, month = currentFilter.month) {
  currentFilter = { loc: locKey, month };
  document.querySelectorAll('#filters .chip').forEach((x) => x.classList.toggle('is-active', x.dataset.filter === locKey));
  renderCamps();
}
document.getElementById('filters').addEventListener('click', (e) => {
  const b = e.target.closest('[data-filter]');
  if (b) setFilter(b.dataset.filter);
});
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-filter-go]');
  if (!go) return;
  e.preventDefault();
  setFilter(go.dataset.filterGo, 'all');
  document.getElementById('camps').scrollIntoView({ behavior: 'smooth' });
});

// ---------- Строка поиска ----------
const search = document.getElementById('search');
search.addEventListener('submit', (e) => {
  e.preventDefault();
  setFilter(search.loc.value, search.month.value);
  document.querySelectorAll('.form [name=participant]').forEach((s) => { s.value = search.fmt.value; s.form?.updateTotal?.(); });
  document.getElementById('camps').scrollIntoView({ behavior: 'smooth' });
});
function fillMonths() {
  const months = [...new Set(upcoming.map((c) => monthKey(c.start)))];
  document.getElementById('searchMonth').innerHTML = '<option value="all">Любые даты</option>'
    + months.map((m) => `<option value="${m}">${monthLabel(m + '-01')}</option>`).join('');
}

// ---------- Формы ----------
const tpl = document.getElementById('formTpl');
const campOptions = () => '<option value="">Выберите кемп и даты</option>' + Object.entries(LOCATIONS).map(([key, L]) => {
  const items = upcoming.filter((c) => c.loc === key);
  return items.length ? `<optgroup label="${L.place}">` + items.map((c) =>
    `<option value="${c.id}">${L.short}: ${fmtRange(c.start, c.end)} ${c.start.slice(0, 4)}${isSold(c) ? ' (лист ожидания)' : ''}</option>`).join('') + '</optgroup>' : '';
}).join('') + '<option value="undecided">Пока не знаю даты — нужна консультация</option>';

function setupForm(form) {
  form.innerHTML = '';
  form.appendChild(tpl.content.cloneNode(true));
  form.camp.innerHTML = campOptions();
  const total = form.querySelector('.price-total');
  const updateTotal = () => {
    const c = CAMPS.find((x) => x.id === form.camp.value);
    if (!c) { total.hidden = true; return; }
    const L = loc(c);
    const pair = form.participant.value === '2';
    total.hidden = false;
    total.innerHTML = L.priceOne == null
      ? 'Стоимость: <b>по запросу</b> <span>· пришлём программу и цену</span>'
      : `Стоимость: <b>${fmtPrice(pair ? L.pricePair : L.priceOne)}</b> ${pair ? 'за двоих' : 'за одного'} <span>· ${L.note}</span>`;
  };
  form.updateTotal = updateTotal;
  form.participant.addEventListener('change', updateTotal);
  form.camp.addEventListener('change', updateTotal);
  updateTotal();

  form.phone.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (!v) return (e.target.value = '');
    if (v[0] === '8') v = '7' + v.slice(1);
    if (v[0] !== '7') v = '7' + v;
    v = v.slice(0, 11);
    let r = '+7';
    if (v.length > 1) r += ' (' + v.slice(1, 4);
    if (v.length >= 4) r += ')';
    if (v.length > 4) r += ' ' + v.slice(4, 7);
    if (v.length > 7) r += '-' + v.slice(7, 9);
    if (v.length > 9) r += '-' + v.slice(9, 11);
    e.target.value = r;
  });
  form.addEventListener('input', (e) => e.target.closest('.field')?.classList.remove('is-invalid'));
  form.onsubmit = (e) => submit(e, form);
}

function validate(form) {
  const bad = [];
  if (!form.camp.value) bad.push('camp');
  if (form.name.value.trim().length < 2) bad.push('name');
  if (form.phone.value.replace(/\D/g, '').length < 11) bad.push('phone');
  bad.forEach((n) => form[n].closest('.field').classList.add('is-invalid'));
  if (!form.consent.checked) bad.push('consent');
  return bad;
}

function staticFallback(form, data) {
    const text = [
      'Здравствуйте! Хочу на теннисный кемп.',
      `Кемп: ${data.camp}`,
      `Имя: ${data.name}`,
      `Телефон: ${data.phone}`,
      data.email && `Telegram/e-mail: ${data.email}`,
      `Формат: ${data.participant}, уровень: ${data.level}`,
      data.comment && `Комментарий: ${data.comment}`,
    ].filter(Boolean).join('\n');
    let copied = false;
    try { navigator.clipboard.writeText(text); copied = true; } catch {}
    form.innerHTML = `
      <div class="form__success">
        <div class="big">✓</div>
        <h3>Почти готово!</h3>
        <p>${copied ? 'Текст заявки скопирован. Откройте Telegram, вставьте его в чат и отправьте — мы ответим лично.' : 'Скопируйте текст ниже и отправьте его нам в Telegram.'}</p>
        <textarea class="static-msg" rows="6" readonly>${text.replace(/</g, '&lt;')}</textarea>
        <a class="btn" href="${TG_CHAT}" target="_blank" rel="noopener">Открыть Telegram</a>
      </div>`;

}

async function submit(e, form) {
  e.preventDefault();
  const err = form.querySelector('.form__error');
  err.textContent = '';
  const bad = validate(form);
  if (bad.length) {
    err.textContent = bad.length === 1 && bad[0] === 'consent' ? 'Нужно согласие на обработку данных' : 'Проверьте выделенные поля';
    form.querySelector('.is-invalid input, .is-invalid select')?.focus();
    return;
  }
  const data = Object.fromEntries(new FormData(form));
  const camp = CAMPS.find((c) => c.id === data.camp);
  data.camp = camp ? campLabel(camp) : 'Нужна консультация по датам';
  data.people = data.participant;
  data.participant = data.participant === '2' ? 'Пара' : 'Один / одна';

  const btn = form.querySelector('[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Отправляем…';
  try {
    const res = await fetch(STATIC_MODE ? WORKER_URL + '/lead' : 'api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!res.ok) throw new Error();
    form.innerHTML = `
      <div class="form__success">
        <div class="big">✓</div>
        <h3>Заявка принята!</h3>
        <p>${data.name.trim().split(' ')[0]}, спасибо! Мы свяжемся с вами (${data.contact}) и расскажем подробности.</p>
        <a class="btn btn--outline" href="https://t.me/prana_kitchen_worldwide" target="_blank" rel="noopener">Написать в Telegram</a>
      </div>`;
    toast('Заявка отправлена — скоро свяжемся!');
  } catch {
    if (STATIC_MODE) return staticFallback(form, data);
    err.innerHTML = 'Не удалось отправить. Попробуйте ещё раз или напишите в <a href="https://t.me/prana_kitchen_worldwide" target="_blank">Telegram</a>.';
    btn.disabled = false;
    btn.textContent = 'Отправить заявку';
  }
}

const mainForm = document.getElementById('applyForm');
const modalForm = document.getElementById('modalForm');

// ---------- Модалка ----------
const modal = document.getElementById('modal');
const nav = document.querySelector('.nav');
function openModal(campId) {
  if (!modalForm.camp) setupForm(modalForm);
  const c = CAMPS.find((x) => x.id === campId);
  modalForm.camp.value = c ? c.id : campId === 'undecided' ? 'undecided' : '';
  modalForm.participant.value = search.fmt.value;
  modalForm.updateTotal();
  document.getElementById('modalTitle').textContent = c ? (isSold(c) ? 'Лист ожидания' : loc(c).title) : 'Заявка на кемп';
  document.getElementById('modalSub').textContent = c ? campLabel(c) : 'Свяжемся с вами и расскажем подробности';
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
  setTimeout(() => modalForm.name?.focus(), 250);
}
function closeModal() {
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no-scroll');
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-apply]');
  if (a) { e.preventDefault(); nav.classList.remove('menu-open'); openModal(a.dataset.apply); }
  if (e.target.closest('[data-close]')) closeModal();
});
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeModal());

// ---------- Toast ----------
let toastT;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('is-show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('is-show'), 3500);
}

// ---------- Меню ----------
document.getElementById('burger').addEventListener('click', () => nav.classList.toggle('menu-open'));
document.getElementById('navLinks').addEventListener('click', (e) => e.target.tagName === 'A' && nav.classList.remove('menu-open'));

// ---------- Анимация появления ----------
const io = new IntersectionObserver((entries) => entries.forEach((en) => {
  if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
}), { threshold: .1 });
document.querySelectorAll('.section h2, .tile, .service, .level, .timeline li, .place, .courts, .callout, .faq__list details, .about__photos img')
  .forEach((el) => { el.classList.add('reveal'); io.observe(el); });

// ---------- Загрузка расписания ----------
async function loadCamps() {
  try {
    const res = await fetch('api/camps');
    if (!res.ok) throw new Error();
    CAMPS = await res.json();
  } catch {
    // нет сервера (GitHub Pages) — берём расписание из camps.json
    STATIC_MODE = true;
    try {
      const r = await fetch(WORKER_URL + '/camps', { cache: 'no-store' });
      if (!r.ok) throw new Error();
      CAMPS = await r.json();
    } catch {
      try { CAMPS = await (await fetch('camps.json', { cache: 'no-store' })).json(); } catch { CAMPS = []; }
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  upcoming = CAMPS.filter((c) => c.start > today).sort((a, b) => a.start.localeCompare(b.start));
  renderCamps();
  fillMonths();
  setupForm(mainForm);
  setupForm(modalForm);
}
loadCamps();

// ---------- Галерея ----------
const PHOTO_ALT = {
  '01.jpg': 'Корты среди зелёных гор под голубым небом',
  '02.jpg': 'Тренер показывает технику удара ученице на корте у скалы',
  '03.jpg': 'Игра на корте с видом на море и горы',
  '04.jpg': 'Грунтовый корт на фоне гор',
  '05.jpg': 'Парная игра на грунте на фоне горы',
  '06.jpg': 'Участница кемпа готовится к удару справа',
  '07.jpg': 'Терраса с зонтиками у грунтового корта',
  '08.jpg': 'Роспись теннисного клуба в Каше и цветущая бугенвиллея',
  '09.jpg': 'Кафе теннисного клуба на закате',
  '10.jpg': 'Участницы кемпа в стойке на грунтовом корте',
};
const galleryEl = document.getElementById('gallery');
const lb = document.getElementById('lightbox');
const lbImg = document.getElementById('lightboxImg');
let photos = [];
let lbIndex = 0;
fetch('api/photos').then((r) => { if (!r.ok) throw new Error(); return r.json(); })
  .catch(() => fetch('photos.json').then((r) => r.json()))
  .then((list) => {
  photos = list.map((src) => ({ src, alt: PHOTO_ALT[decodeURIComponent(src.split('/').pop())] || 'Фото с теннисного кемпа' }));
  if (!photos.length) return document.getElementById('photos').remove();
  galleryEl.innerHTML = photos.map((p, i) => `<button class="gallery__item" data-i="${i}"><img src="${p.src}" alt="${p.alt}" decoding="async"></button>`).join('');
}).catch(() => document.getElementById('photos')?.remove());

function showPhoto(i) {
  lbIndex = (i + photos.length) % photos.length;
  lbImg.src = photos[lbIndex].src;
  lbImg.alt = photos[lbIndex].alt;
  document.getElementById('lightboxCount').textContent = `${lbIndex + 1} / ${photos.length}`;
}
function openLightbox(i) { showPhoto(i); lb.classList.add('is-open'); lb.setAttribute('aria-hidden', 'false'); document.body.classList.add('no-scroll'); }
function closeLightbox() { lb.classList.remove('is-open'); lb.setAttribute('aria-hidden', 'true'); document.body.classList.remove('no-scroll'); }
galleryEl.addEventListener('click', (e) => { const it = e.target.closest('.gallery__item'); if (it) openLightbox(+it.dataset.i); });
lb.addEventListener('click', (e) => {
  const a = e.target.closest('[data-lb]')?.dataset.lb;
  if (a === 'prev') showPhoto(lbIndex - 1);
  else if (a === 'next') showPhoto(lbIndex + 1);
  else if (a === 'close' || e.target === lb) closeLightbox();
});
document.addEventListener('keydown', (e) => {
  if (!lb.classList.contains('is-open')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') showPhoto(lbIndex - 1);
  if (e.key === 'ArrowRight') showPhoto(lbIndex + 1);
});
let touchX = null;
lb.addEventListener('touchstart', (e) => (touchX = e.touches[0].clientX), { passive: true });
lb.addEventListener('touchend', (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 50) showPhoto(lbIndex + (dx < 0 ? 1 : -1));
  touchX = null;
});
