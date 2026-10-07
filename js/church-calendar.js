'use strict';

/*
 * Расчёты церковного календаря: Пасха, переходящие праздники, посты.
 *
 * Все даты создаются как локальные (new Date(год, месяц, день)), без UTC:
 * так «сегодня» и дни недели совпадают с часовым поясом посетителя.
 * Данные берутся из js/data.js.
 */
const ChurchCalendar = (() => {
    const DAY_MS = 24 * 60 * 60 * 1000;

    // Разница между старым (юлианским) и новым стилем — 13 дней (до 28.02.2100).
    const JULIAN_OFFSET = 13;

    // Порядок важности событий внутри одного дня
    const TYPE_PRIORITY = ['pascha', 'twelve', 'great', 'revered', 'local', 'icon', 'saint', 'memorial'];

    const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
    const daysBetween = (from, to) => Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
    const isSameDay = (a, b) => daysBetween(a, b) === 0;
    const inRange = (day, from, to) => day >= from && day <= to;
    const toJulian = (date) => addDays(date, -JULIAN_OFFSET);

    const pad = (n) => String(n).padStart(2, '0');
    const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

    function parseKey(key) {
        const [y, m, d] = key.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    // Православная Пасха: расчёт по юлианскому календарю, результат — по новому стилю.
    function orthodoxEaster(year) {
        const a = year % 4;
        const b = year % 7;
        const c = year % 19;
        const d = (19 * c + 15) % 30;
        const e = (2 * a + 4 * b - d + 34) % 7;
        const month = Math.floor((d + e + 114) / 31);
        const day = ((d + e + 114) % 31) + 1;
        return new Date(year, month - 1, day + JULIAN_OFFSET);
    }

    const paschaCache = new Map();
    function getPascha(year) {
        if (!paschaCache.has(year)) paschaCache.set(year, orthodoxEaster(year));
        return paschaCache.get(year);
    }

    function fromMonthDay(monthDay, year) {
        const [m, d] = monthDay.split('-').map(Number);
        return new Date(year, m - 1, d);
    }

    // Превращает правило из data.js (date / offset / saturdayBefore) в дату конкретного года
    function resolveDate(rule, year) {
        if (rule.offset !== undefined) return addDays(getPascha(year), rule.offset);
        if (rule.saturdayBefore) {
            const target = fromMonthDay(rule.saturdayBefore, year);
            return addDays(target, -((target.getDay() + 1) % 7 || 7));
        }
        return fromMonthDay(rule.date, rule.nextYear ? year + 1 : year);
    }

    const yearCache = new Map();
    function getYearData(year) {
        if (yearCache.has(year)) return yearCache.get(year);

        const events = CHURCH_EVENTS
            .map((def) => ({ ...def, date: resolveDate(def, year) }))
            .sort((a, b) => a.date - b.date || TYPE_PRIORITY.indexOf(a.type) - TYPE_PRIORITY.indexOf(b.type));

        const eventsByDay = new Map();
        for (const ev of events) {
            const key = dateKey(ev.date);
            if (!eventsByDay.has(key)) eventsByDay.set(key, []);
            eventsByDay.get(key).push(ev);
        }

        const fasts = MULTI_DAY_FASTS.map((f) => {
            const start = resolveDate(f.start, year);
            const end = resolveDate(f.end, year);
            return { ...f, start, end, days: daysBetween(start, end) + 1 };
        });
        const oneDayFasts = ONE_DAY_FASTS.map((f) => ({ ...f, date: resolveDate(f, year) }));
        const fastFreeWeeks = FAST_FREE_WEEKS.map((w) => ({
            ...w, start: resolveDate(w.start, year), end: resolveDate(w.end, year)
        }));

        const data = { events, eventsByDay, fasts, oneDayFasts, fastFreeWeeks };
        yearCache.set(year, data);
        return data;
    }

    function findFast(day, events, fastFree) {
        const year = day.getFullYear();
        // Рождественский пост начинается в прошлом году, поэтому смотрим и его
        const multi = [...getYearData(year).fasts, ...getYearData(year - 1).fasts]
            .find((f) => inRange(day, f.start, f.end));
        if (multi) return { kind: 'multi', ...multi };

        const strict = getYearData(year).oneDayFasts.find((f) => isSameDay(f.date, day));
        if (strict) return { kind: 'strict', ...strict };

        const weekday = day.getDay();
        if ((weekday === 3 || weekday === 5) && !fastFree && !events.some((e) => e.noFast)) {
            return {
                kind: 'weekly',
                name: weekday === 3 ? 'Постный день — среда' : 'Постный день — пятница',
                desc: WEEKLY_FAST_DESC[weekday]
            };
        }
        return null;
    }

    // Всё о конкретном дне: события, пост, сплошная седмица
    function getDayInfo(date) {
        const day = startOfDay(date);
        const data = getYearData(day.getFullYear());
        const events = data.eventsByDay.get(dateKey(day)) || [];
        const fastFree = data.fastFreeWeeks.find((w) => inRange(day, w.start, w.end)) || null;
        return { date: day, key: dateKey(day), events, fastFree, fast: findFast(day, events, fastFree) };
    }

    // Ближайшее событие указанных видов строго после даты from
    function findNextEvent(from, types) {
        const day = startOfDay(from);
        for (const year of [day.getFullYear(), day.getFullYear() + 1]) {
            const ev = getYearData(year).events.find((e) => e.date > day && types.includes(e.type));
            if (ev) return ev;
        }
        return null;
    }

    return {
        TYPE_PRIORITY,
        startOfDay,
        addDays,
        daysBetween,
        isSameDay,
        dateKey,
        parseKey,
        toJulian,
        getPascha,
        getDayInfo,
        findNextEvent,
        getYearEvents: (year) => getYearData(year).events,
        getYearFasts: (year) => getYearData(year).fasts,
        getOneDayFasts: (year) => getYearData(year).oneDayFasts,
        getFastFreeWeeks: (year) => getYearData(year).fastFreeWeeks
    };
})();
