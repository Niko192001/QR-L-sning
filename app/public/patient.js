(function () {
  const id = location.pathname.split('/').filter(Boolean).pop();
  const $ = (s) => document.getElementById(s);
  const sections = ['loading', 'notfound', 'called', 'waiting'];

  function show(name) {
    for (const s of sections) $(s).classList.toggle('hidden', s !== name);
  }

  const clockOf = (date) =>
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  function waitText(minutes) {
    if (minutes === 0) return 'Du er den næste';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const parts = [];
    if (h) parts.push(h === 1 ? '1 time' : `${h} timer`);
    if (m) parts.push(`${m} min.`);
    return `Om ca. ${parts.join(' og ')}`;
  }

  function tick() {
    $('clock').textContent = clockOf(new Date());
  }

  async function refresh() {
    let res;
    try {
      res = await fetch(`/api/patients/${encodeURIComponent(id)}`, { cache: 'no-store' });
    } catch {
      return; // Netværksfejl: prøv igen ved næste opdatering
    }
    if (res.status === 404) return show('notfound');
    if (!res.ok) return;
    const s = await res.json();

    $('greeting').textContent = `Hej ${s.name.split(' ')[0]}`;
    if (s.status === 'called') return show('called');

    $('position').textContent = s.position;
    $('eta').textContent = clockOf(new Date(Date.now() + s.waitMinutes * 60000));
    $('eta-hint').textContent = waitText(s.waitMinutes);
    const d = s.delay;
    $('delay').classList.toggle('hidden', !d);
    if (d) {
      $('delay-text').textContent = `Din tid er udskudt med ca. ${d.minutes} min.`;
      $('delay-reason').textContent = `Begrundelse: ${d.reason}`;
    }
    show('waiting');
  }

  tick();
  setInterval(tick, 10000);
  refresh();
  setInterval(refresh, 5000);
})();
