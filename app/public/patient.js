(function () {
  const id = location.pathname.split('/').filter(Boolean).pop();
  const $ = (s) => document.getElementById(s);
  const sections = ['loading', 'notfound', 'called', 'waiting'];

  function show(name) {
    for (const s of sections) $(s).classList.toggle('hidden', s !== name);
  }

  // Statuslinjens ur i telefon-rammen viser det rigtige klokkeslæt.
  const clockOf = (date) =>
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  // Nedtællingen kører lokalt hvert sekund mellem opdateringerne fra serveren.
  let turnAt = null;

  function tick() {
    $('clock').textContent = clockOf(new Date());
    if (turnAt !== null) {
      $('countdown').textContent = Eta.countdownText(Math.max(0, (turnAt - Date.now()) / 1000));
    }
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
    $('eta').textContent = Eta.etaClock(s.waitMinutes);
    turnAt = Date.now() + s.waitSeconds * 1000;
    tick();
    const d = s.delay;
    $('delay').classList.toggle('hidden', !d);
    if (d) {
      $('delay-text').textContent = `Din tid er udskudt med ca. ${d.minutes} min.`;
      $('delay-reason').textContent = `Begrundelse: ${d.reason}`;
    }
    show('waiting');
  }

  tick();
  setInterval(tick, 1000);
  refresh();
  setInterval(refresh, 5000);
})();
