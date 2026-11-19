// Forventet tidspunkt, afrundet til nærmeste kvarter, så det ikke tæller op hvert minut.
// Bruges af både patient- og sekretær-siden (og af tests i Node).
(function (root) {
  const STEP = 15;
  const pad = (n) => String(n).padStart(2, '0');

  function etaClock(waitMinutes, now = new Date()) {
    const ms = STEP * 60000;
    const d = new Date(Math.round((now.getTime() + waitMinutes * 60000) / ms) * ms);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // Nedtælling til ens tur, minut for minut (rundet op, så den først viser 0 når tiden er gået).
  function countdownText(waitSeconds) {
    if (waitSeconds <= 0) return 'Det er snart din tur';
    const total = Math.ceil(waitSeconds / 60);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h ? `Din tur om ${h} t. ${m} min.` : `Din tur om ${m} min.`;
  }

  const api = { etaClock, countdownText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Eta = api;
})(this);
