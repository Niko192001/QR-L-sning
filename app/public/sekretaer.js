(function () {
  const $ = (s) => document.getElementById(s);
  let priorities = [];

  const etaClock = (min) => {
    const d = new Date(Date.now() + min * 60000);
    return `kl. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const prio = (level) => priorities.find((p) => p.level === level);

  async function api(path, body) {
    const res = await fetch(path, body === undefined ? { cache: 'no-store' } : {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Der skete en fejl. Prøv igen.');
    return data;
  }

  function fillPriorities(select, selected) {
    select.replaceChildren(
      ...priorities.map((p) => {
        const o = document.createElement('option');
        o.value = p.level;
        o.textContent = `${p.name} (${p.level})`;
        o.selected = p.level === selected;
        return o;
      })
    );
  }

  function showQr(name, url, qr) {
    $('qr-title').textContent = `QR-kode til ${name}`;
    $('qr-img').src = qr;
    $('qr-link').href = url;
    $('qr-link').textContent = url;
    $('qr-dialog').showModal();
  }

  function row(p) {
    const tr = document.createElement('tr');
    const pr = prio(p.priority);
    const cell = (cls, text) => {
      const td = document.createElement('td');
      if (cls) td.className = cls;
      if (text !== undefined) td.textContent = text;
      tr.append(td);
      return td;
    };
    cell('num', p.position);
    cell('', p.name);
    const pc = cell('');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = pr.color;
    pc.append(dot, pr.name);
    cell('num', etaClock(p.waitMinutes));
    const actions = cell('actions');

    const qrBtn = document.createElement('button');
    qrBtn.className = 'secondary';
    qrBtn.textContent = 'Vis QR';
    qrBtn.onclick = async () => {
      const { url, qr } = await api(`/api/patients/${p.id}/qr`);
      showQr(p.name, url, qr);
    };
    const callBtn = document.createElement('button');
    callBtn.textContent = 'Kald ind';
    callBtn.onclick = async () => {
      callBtn.disabled = true;
      await api(`/api/patients/${p.id}/call`, {}).catch(() => {});
      refresh();
    };
    actions.append(qrBtn, callBtn);
    return tr;
  }

  async function refresh() {
    let queue;
    try {
      queue = await api('/api/patients');
    } catch {
      return;
    }
    $('queue-body').replaceChildren(...queue.map(row));
    $('count').textContent = `(${queue.length})`;
    $('empty').classList.toggle('hidden', queue.length > 0);
  }

  $('create-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('create-error').textContent = '';
    try {
      const { patient, url, qr } = await api('/api/patients', {
        cpr: $('cpr').value,
        priority: Number($('priority').value),
      });
      $('cpr').value = '';
      showQr(patient.name, url, qr);
      refresh();
    } catch (err) {
      $('create-error').textContent = err.message;
    }
  });

  $('urgent-reason').addEventListener('change', () => {
    $('other-field').classList.toggle('hidden', $('urgent-reason').value !== '__other');
  });

  $('urgent-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('urgent-error').textContent = '';
    const choice = $('urgent-reason').value;
    const reason = choice === '__other' ? $('urgent-other').value : choice;
    try {
      await api('/api/urgent', { priority: Number($('urgent-priority').value), reason });
      $('urgent-other').value = '';
      refresh();
    } catch (err) {
      $('urgent-error').textContent = err.message;
    }
  });

  (async function init() {
    priorities = await api('/api/priorities');
    fillPriorities($('priority'), 3);
    fillPriorities($('urgent-priority'), 1);
    refresh();
    setInterval(refresh, 5000);
  })();
})();
