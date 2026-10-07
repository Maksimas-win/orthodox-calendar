'use strict';

/*
 * Отрисовка страницы и интерактив.
 * Данные — js/data.js, расчёты дат — js/church-calendar.js.
 */
(() => {
    const CC = ChurchCalendar;

    const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const MIN_YEAR = 1901;
    const MAX_YEAR = 2099;

    const TYPE_LABELS = {
        pascha: 'Праздник праздников',
        twelve: 'Двунадесятый праздник',
        great: 'Великий праздник',
        revered: 'Особо чтимый праздник',
        local: 'Местночтимые святые',
        icon: 'Икона Богородицы',
        saint: 'День памяти',
        memorial: 'Поминовение усопших'
    };
    const FAST_LABELS = { multi: 'Многодневный пост', strict: 'Строгий пост', weekly: 'Постный день' };
    const FEAST_TYPES = ['pascha', 'twelve', 'great', 'revered', 'local'];

    const AZBYKA_DAY_URL = 'https://azbyka.ru/days/';

    const state = { todayKey: '', viewYear: 0, viewMonth: 0, countdownTarget: null };

    const $ = (selector) => document.querySelector(selector);
    const pluralRules = new Intl.PluralRules('ru-RU');

    // ── Форматирование ─────────────────────────────────────────────────────

    function escapeHtml(text) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return String(text).replace(/[&<>"']/g, (ch) => map[ch]);
    }

    function plural(n, one, few, many) {
        const rule = pluralRules.select(n);
        return rule === 'one' ? one : rule === 'few' ? few : many;
    }

    const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const fmtDayMonth = (d) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const fmtDayMonthYear = (d) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    const fmtWeekday = (d) => d.toLocaleDateString('ru-RU', { weekday: 'long' });
    const fmtWithWeekday = (d) => `${fmtDayMonth(d)}, ${fmtWeekday(d)}`;
    const fmtFull = (d) => capitalize(d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    const fmtJulian = (d) => fmtDayMonth(CC.toJulian(d));
    const fmtDays = (n) => `${n} ${plural(n, 'день', 'дня', 'дней')}`;

    function fmtRange(start, end) {
        const endText = start.getFullYear() === end.getFullYear() ? fmtDayMonth(end) : fmtDayMonthYear(end);
        return `${fmtDayMonth(start)} — ${endText}`;
    }

    const today = () => CC.startOfDay(new Date());

    // ── Общие фрагменты разметки ───────────────────────────────────────────

    function sectionTitle(icon, title, year) {
        return `<h2 class="section-title"><span aria-hidden="true">${icon}</span> ${title} <span class="section-year">${year}</span></h2>`;
    }

    function eventCard(ev, { showDate = false, extraClass = '' } = {}) {
        const typeClass = ev.type === 'local' ? ' vilnius-saints' : ev.type === 'pascha' ? ' pascha-card' : '';
        return `
            <button type="button" class="holiday-card${typeClass}${extraClass}" data-day="${CC.dateKey(ev.date)}">
                <span class="holiday-type ${ev.type}">${TYPE_LABELS[ev.type]}</span>
                <span class="holiday-name">${escapeHtml(ev.name)}</span>
                ${showDate ? `<span class="holiday-date">${fmtWithWeekday(ev.date)}</span>` : ''}
                ${ev.desc ? `<span class="holiday-desc">${escapeHtml(ev.desc)}</span>` : ''}
            </button>`;
    }

    function fastDetails(fast) {
        if (fast.kind !== 'multi') return '';
        return `<span class="holiday-desc">${fmtRange(fast.start, fast.end)} · ${fmtDays(fast.days)}</span>`;
    }

    function fastCard(fast, key) {
        return `
            <button type="button" class="holiday-card fast-card" data-day="${key}">
                <span class="holiday-type fast">${FAST_LABELS[fast.kind]}</span>
                <span class="holiday-name">${escapeHtml(fast.name)}</span>
                <span class="holiday-desc">${escapeHtml(fast.desc)}</span>
                ${fastDetails(fast)}
            </button>`;
    }

    function fastFreeCard(week, key) {
        return `
            <button type="button" class="holiday-card" data-day="${key}">
                <span class="holiday-type fast-free">Сплошная седмица</span>
                <span class="holiday-name">${escapeHtml(week.name)}</span>
                <span class="holiday-desc">Пост в среду и пятницу отменяется. ${escapeHtml(week.desc)}</span>
            </button>`;
    }

    // ── Фоновые частицы ────────────────────────────────────────────────────

    function createParticles() {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const count = window.innerWidth < 600 ? 12 : 30;
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
            const p = document.createElement('span');
            p.className = 'particle';
            p.style.left = `${Math.random() * 100}%`;
            p.style.animationDelay = `${Math.random() * 15}s`;
            p.style.animationDuration = `${10 + Math.random() * 10}s`;
            fragment.appendChild(p);
        }
        $('#particles').appendChild(fragment);
    }

    // ── Карточка храма ─────────────────────────────────────────────────────

    function setupChurchCard() {
        const card = $('#churchCard');
        const front = card.querySelector('.card-front');
        const back = card.querySelector('.card-back');
        back.inert = true;

        card.addEventListener('click', (e) => {
            if (e.target.closest('a')) return; // ссылка на расписание не должна переворачивать карточку
            const flipped = card.classList.toggle('flipped');
            front.inert = flipped;
            back.inert = !flipped;
            if (e.detail === 0) { // нажатие с клавиатуры — переносим фокус на видимую сторону
                (flipped ? back : front).querySelector('button').focus();
            }
        });
    }

    // ── Сегодня ────────────────────────────────────────────────────────────

    function renderToday() {
        const day = today();
        const info = CC.getDayInfo(day);
        const cards = [
            ...info.events.map((ev) => eventCard(ev)),
            info.fast ? fastCard(info.fast, info.key) : '',
            info.fastFree ? fastFreeCard(info.fastFree, info.key) : ''
        ].join('');

        const next = CC.findNextEvent(day, FEAST_TYPES);
        let nextHtml = '';
        if (next) {
            const days = CC.daysBetween(day, next.date);
            const when = days === 1 ? 'завтра' : `через ${fmtDays(days)}`;
            nextHtml = `
                <button type="button" class="next-feast" data-day="${CC.dateKey(next.date)}">
                    <span class="next-feast-label">Ближайший праздник</span>
                    <strong>${escapeHtml(next.name)}</strong> — ${fmtWithWeekday(next.date)}, ${when}
                </button>`;
        }

        $('#todaySection').innerHTML = `
            <div class="today-header">
                <h2 class="today-date"><span class="weekday">${fmtWeekday(day)}</span>${fmtDayMonthYear(day)}</h2>
                <div class="julian-date">По старому стилю: ${fmtJulian(day)}</div>
            </div>
            ${cards
                ? `<div class="holidays-grid">${cards}</div>`
                : '<p class="today-empty">Сегодня нет больших праздников. Святых дня смотрите выше, в разделе «Азбука веры».</p>'}
            ${nextHtml}`;
    }

    // ── Отсчёт до Пасхи ────────────────────────────────────────────────────

    const COUNTDOWN_UNITS = [
        { key: 'days', forms: ['день', 'дня', 'дней'] },
        { key: 'hours', forms: ['час', 'часа', 'часов'] },
        { key: 'minutes', forms: ['минута', 'минуты', 'минут'] },
        { key: 'seconds', forms: ['секунда', 'секунды', 'секунд'] }
    ];

    function updateCountdown(now) {
        const day = CC.startOfDay(now);
        const pascha = CC.getPascha(day.getFullYear());
        const leaveTaking = CC.addDays(pascha, 38); // отдание Пасхи
        const display = $('#countdownDisplay');

        // Пасхальный период — приветствие вместо отсчёта
        if (day >= pascha && day <= leaveTaking) {
            if (state.countdownTarget !== 'paschal') {
                state.countdownTarget = 'paschal';
                $('#countdownTitle').textContent = 'Светлое Христово Воскресение';
                display.innerHTML = `
                    <div class="paschal-greeting">
                        <p class="paschal-main">Христос Воскресе!</p>
                        <p class="paschal-answer">Воистину Воскресе!</p>
                    </div>`;
                $('#easterDateInfo').textContent = `Пасхальный период продолжается до отдания Пасхи — ${fmtWithWeekday(leaveTaking)}.`;
            }
            return;
        }

        const target = day < pascha ? pascha : CC.getPascha(day.getFullYear() + 1);
        if (state.countdownTarget !== target.getTime()) {
            state.countdownTarget = target.getTime();
            $('#countdownTitle').textContent = 'До Светлого Христова Воскресения';
            display.innerHTML = COUNTDOWN_UNITS.map((u) => `
                <div class="countdown-item">
                    <div class="countdown-number" data-unit="${u.key}">0</div>
                    <div class="countdown-label" data-label="${u.key}"></div>
                </div>`).join('');
            $('#easterDateInfo').innerHTML =
                `Пасха в ${target.getFullYear()} году: <strong>${fmtDayMonth(target)}</strong> (${fmtJulian(target)} ст. ст.)`;
        }

        const total = Math.max(0, Math.floor((target - now) / 1000));
        const values = {
            days: Math.floor(total / 86400),
            hours: Math.floor((total % 86400) / 3600),
            minutes: Math.floor((total % 3600) / 60),
            seconds: total % 60
        };
        for (const u of COUNTDOWN_UNITS) {
            display.querySelector(`[data-unit="${u.key}"]`).textContent = values[u.key];
            display.querySelector(`[data-label="${u.key}"]`).textContent = plural(values[u.key], ...u.forms);
        }
    }

    // ── Календарь на месяц ─────────────────────────────────────────────────

    function setupCalendarControls() {
        const yearNav = $('#yearNav');
        const currentYear = new Date().getFullYear();
        yearNav.innerHTML = [currentYear - 1, currentYear, currentYear + 1]
            .map((y) => `<button type="button" class="year-btn" data-year="${y}">${y}</button>`)
            .join('') + '<button type="button" class="year-btn today-btn" data-today>Сегодня</button>';

        yearNav.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            if (btn.hasAttribute('data-today')) {
                const now = new Date();
                setView(now.getFullYear(), now.getMonth());
            } else {
                setView(Number(btn.dataset.year), state.viewMonth);
            }
        });
        $('#prevMonth').addEventListener('click', () => setView(state.viewYear, state.viewMonth - 1));
        $('#nextMonth').addEventListener('click', () => setView(state.viewYear, state.viewMonth + 1));
    }

    function setView(year, month) {
        const d = new Date(year, month, 1);
        if (d.getFullYear() < MIN_YEAR || d.getFullYear() > MAX_YEAR) return;
        const yearChanged = d.getFullYear() !== state.viewYear;
        state.viewYear = d.getFullYear();
        state.viewMonth = d.getMonth();
        renderCalendar();
        if (yearChanged) renderYearSections(state.viewYear);
    }

    function tooltipLine(type, text) {
        return `<span class="day-tooltip-item ${type}"><span class="tt-dot"></span>${escapeHtml(text)}</span>`;
    }

    function dayCell(info, column) {
        const { date, key, events, fast, fastFree } = info;
        const isToday = key === state.todayKey;

        const classes = ['calendar-day'];
        if (date.getDay() === 0) classes.push('sunday');
        if (isToday) classes.push('today');
        if (events.some((e) => e.type === 'pascha')) classes.push('pascha');
        if (fast) classes.push(fast.kind === 'weekly' ? 'fast-weekly' : 'fast-day');
        if (column === 0) classes.push('col-first');
        if (column === 6) classes.push('col-last');

        const indicators = [...new Set(events.map((e) => e.type))]
            .map((t) => `<span class="indicator ${t}"></span>`).join('');

        const lines = events.map((e) => tooltipLine(e.type, e.name));
        if (fast) lines.push(tooltipLine('fast', fast.name));
        if (fastFree) lines.push(tooltipLine('fast-free', `${fastFree.name} — поста нет`));
        const tooltip = lines.length
            ? `<span class="day-tooltip" aria-hidden="true"><span class="day-tooltip-date">${fmtDayMonth(date)} · ст. ст. ${fmtJulian(date)}</span>${lines.join('')}</span>`
            : '';

        const label = [fmtFull(date), ...events.map((e) => e.name), fast ? fast.name : ''].filter(Boolean).join('. ');

        return `
            <button type="button" class="${classes.join(' ')}" data-day="${key}" aria-label="${escapeHtml(label)}"${isToday ? ' aria-current="date"' : ''}>
                <span class="day-number">${date.getDate()}</span>
                ${indicators ? `<span class="day-indicators">${indicators}</span>` : ''}
                ${tooltip}
            </button>`;
    }

    function renderCalendar() {
        const { viewYear: year, viewMonth: month } = state;
        $('#currentMonth').textContent = `${MONTHS[month]} ${year}`;
        document.querySelectorAll('#yearNav [data-year]').forEach((btn) => {
            const active = Number(btn.dataset.year) === year;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-pressed', String(active));
        });

        const offset = (new Date(year, month, 1).getDay() + 6) % 7; // неделя начинается с понедельника
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        let html = '<span class="calendar-day empty"></span>'.repeat(offset);
        for (let d = 1; d <= daysInMonth; d++) {
            html += dayCell(CC.getDayInfo(new Date(year, month, d)), (offset + d - 1) % 7);
        }
        $('#calendarGrid').innerHTML = html;
    }

    // ── Списки праздников и постов на год ──────────────────────────────────

    // Индекс первого события, которое ещё не прошло
    const nextIndex = (list, day) => list.findIndex((ev) => ev.date >= day);

    function timelineItem(ev, day, isNext, showType) {
        const classes = ['timeline-item'];
        if (ev.type === 'pascha') classes.push('pascha');
        if (ev.date < day) classes.push('is-past');
        const badge = isNext
            ? `<span class="next-badge">${CC.isSameDay(ev.date, day) ? 'Сегодня' : 'Ближайший'}</span>`
            : '';
        return `
            <button type="button" class="${classes.join(' ')}" data-day="${CC.dateKey(ev.date)}">
                <span class="timeline-date">${fmtWithWeekday(ev.date)}${badge}</span>
                ${showType ? `<span class="timeline-type">${TYPE_LABELS[ev.type]}</span>` : ''}
                <span class="timeline-title">${escapeHtml(ev.name)}</span>
                <span class="timeline-desc">${escapeHtml(ev.desc)}</span>
            </button>`;
    }

    function renderTimeline(selector, icon, title, year, list, day, showType = false) {
        const next = nextIndex(list, day);
        $(selector).innerHTML = `
            ${sectionTitle(icon, title, year)}
            <div class="holidays-timeline">
                ${list.map((ev, i) => timelineItem(ev, day, i === next, showType)).join('')}
            </div>`;
    }

    function renderCards(selector, icon, title, year, list, day) {
        $(selector).innerHTML = `
            ${sectionTitle(icon, title, year)}
            <div class="holidays-grid">
                ${list.map((ev) => eventCard(ev, { showDate: true, extraClass: ev.date < day ? ' is-past' : '' })).join('')}
            </div>`;
    }

    function renderFasting(year, day) {
        const fasts = CC.getYearFasts(year).map((f) => {
            const isCurrent = day >= f.start && day <= f.end;
            const classes = ['fasting-card'];
            if (isCurrent) classes.push('is-current');
            else if (f.end < day) classes.push('is-past');
            return `
                <div class="${classes.join(' ')}">
                    <h3 class="fasting-name">${escapeHtml(f.name)}</h3>
                    <p class="fasting-dates">${fmtRange(f.start, f.end)}</p>
                    <p class="fasting-desc">${escapeHtml(f.desc)}</p>
                    <span class="fasting-duration">${fmtDays(f.days)}</span>
                    ${isCurrent ? '<span class="fasting-duration current">Идёт сейчас</span>' : ''}
                </div>`;
        }).join('');

        const oneDay = CC.getOneDayFasts(year).map((f) => `
            <li><span class="fasting-list-date">${fmtDayMonth(f.date)}</span>${escapeHtml(f.name)}</li>`).join('');

        const fastFree = CC.getFastFreeWeeks(year).map((w) => `
            <li><span class="fasting-list-date">${fmtRange(w.start, w.end)}</span>${escapeHtml(w.name)}</li>`).join('');

        $('#fastingSection').innerHTML = `
            ${sectionTitle('🙏', 'Посты', year)}
            <div class="fasting-grid">
                ${fasts}
                <div class="fasting-card">
                    <h3 class="fasting-name">Однодневные посты</h3>
                    <ul class="fasting-list">
                        <li><span class="fasting-list-date">Каждую неделю</span>Среда и пятница (кроме сплошных седмиц)</li>
                        ${oneDay}
                    </ul>
                </div>
                <div class="fasting-card fast-free-card">
                    <h3 class="fasting-name">Сплошные седмицы</h3>
                    <p class="fasting-desc">Пост в среду и пятницу отменяется.</p>
                    <ul class="fasting-list">${fastFree}</ul>
                </div>
            </div>`;
    }

    function renderYearSections(year) {
        const day = today();
        const events = CC.getYearEvents(year);
        const ofType = (...types) => events.filter((e) => types.includes(e.type));

        renderTimeline('#majorHolidays', '🔴', 'Пасха и двунадесятые праздники', year, ofType('pascha', 'twelve'), day);
        renderTimeline('#greatHolidays', '🟠', 'Великие и особо чтимые праздники', year, ofType('great', 'revered'), day, true);
        renderTimeline('#vilniusSaints', '🟢', 'Виленские мученики', year, ofType('local'), day);
        renderCards('#iconsSection', '🔵', 'Иконы Божией Матери', year, ofType('icon'), day);
        renderCards('#memorialSection', '🕯', 'Дни особого поминовения усопших', year, ofType('memorial'), day);
        renderFasting(year, day);
    }

    // ── Подробности дня (модальное окно) ───────────────────────────────────

    function showDayDetails(key) {
        const info = CC.getDayInfo(CC.parseKey(key));
        let html = info.events.map((ev) => `
            <div class="modal-event">
                <span class="holiday-type ${ev.type}">${TYPE_LABELS[ev.type]}</span>
                <h3>${escapeHtml(ev.name)}</h3>
                ${ev.desc ? `<p>${escapeHtml(ev.desc)}</p>` : ''}
            </div>`).join('');

        if (info.fast) {
            const range = info.fast.kind === 'multi'
                ? `<p>${fmtRange(info.fast.start, info.fast.end)} · ${fmtDays(info.fast.days)}</p>`
                : '';
            html += `
                <div class="modal-event">
                    <span class="holiday-type fast">${FAST_LABELS[info.fast.kind]}</span>
                    <h3>${escapeHtml(info.fast.name)}</h3>
                    <p>${escapeHtml(info.fast.desc)}</p>
                    ${range}
                </div>`;
        }
        if (info.fastFree) {
            html += `
                <div class="modal-event">
                    <span class="holiday-type fast-free">Сплошная седмица</span>
                    <h3>${escapeHtml(info.fastFree.name)}</h3>
                    <p>Пост в среду и пятницу отменяется. ${escapeHtml(info.fastFree.desc)}</p>
                </div>`;
        }
        if (!html) html = '<p class="modal-empty">Обычный день церковного года.</p>';

        html += `<a class="modal-link" href="${AZBYKA_DAY_URL}${key}" target="_blank" rel="noopener">Святые, чтения и богослужебные указания дня на azbyka.ru ↗</a>`;

        $('#modalTitle').textContent = fmtFull(info.date);
        $('#modalDate').textContent = `По старому стилю: ${fmtJulian(info.date)}`;
        $('#modalBody').innerHTML = html;
        $('#dayDialog').showModal();
    }

    function setupDayDetails() {
        const dialog = $('#dayDialog');
        // Любой элемент с data-day открывает подробности этого дня
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-day]');
            if (target) showDayDetails(target.dataset.day);
        });
        $('#modalClose').addEventListener('click', () => dialog.close());
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.close(); // клик по затемнённому фону
        });
    }

    // ── Виджет «Азбука веры» ───────────────────────────────────────────────

    function loadAzbykaWidget() {
        const container = $('.azbyka-saints');
        const showFallback = () => {
            if (container.children.length) return;
            container.innerHTML = `
                <p class="azbyka-fallback">Не удалось загрузить данные «Азбуки веры».
                <a href="${AZBYKA_DAY_URL}${state.todayKey}" target="_blank" rel="noopener">Посмотреть святых дня на azbyka.ru ↗</a></p>`;
        };

        window.___azcfg = {
            api: 'https://azbyka.ru/days/widgets',
            css: 'https://azbyka.ru/days/css/api.min.css',
            image: '1',
            prevNextLinks: '1'
        };
        const script = document.createElement('script');
        script.src = 'https://azbyka.ru/days/js/api.min.js';
        script.async = true;
        script.onerror = showFallback;
        document.body.appendChild(script);
        setTimeout(showFallback, 15000);
    }

    // ── Запуск ─────────────────────────────────────────────────────────────

    function renderAll() {
        renderToday();
        renderCalendar();
        renderYearSections(state.viewYear);
    }

    function tick() {
        const now = new Date();
        const key = CC.dateKey(now);
        if (key !== state.todayKey) { // наступили новые сутки — обновляем «сегодня»
            state.todayKey = key;
            renderAll();
        }
        updateCountdown(now);
    }

    function init() {
        const now = new Date();
        state.todayKey = CC.dateKey(now);
        state.viewYear = now.getFullYear();
        state.viewMonth = now.getMonth();

        createParticles();
        setupChurchCard();
        setupCalendarControls();
        setupDayDetails();
        renderAll();
        loadAzbykaWidget();
        tick();
        setInterval(tick, 1000);
    }

    init();
})();
