(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- nav ---------- */
  const nav = $('#nav');
  const toggle = $('.nav__toggle');
  const onScroll = () => nav.classList.toggle('nav--solid', scrollY > 12);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const setMenu = open => {
    nav.classList.toggle('nav--open', open);
    toggle.setAttribute('aria-expanded', open);
  };
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('nav--open')));
  $$('.nav__links a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => e.key === 'Escape' && setMenu(false));

  $$('[data-year]').forEach(el => (el.textContent = new Date().getFullYear()));

  /* ---------- scroll reveal + self-drawing line art ---------- */
  $$('[data-draw]').forEach(svg => {
    $$('.draw', svg).forEach((el, n) => {
      el.style.setProperty('--len', Math.ceil(el.getTotalLength()) + 1);
      el.style.setProperty('--n', n);
    });
  });

  const io = new IntersectionObserver(entries => {
    entries.forEach(({ isIntersecting, target }) => {
      if (!isIntersecting) return;
      target.classList.add('is-in');
      if (target.hasAttribute('data-draw')) setTimeout(() => target.classList.add('is-drawn'), 2600);
      io.unobserve(target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
  $$('[data-reveal], [data-draw]').forEach(el => io.observe(el));

  /* ---------- wash pane: a dirty surface you clean with the pointer ---------- */
  const rng = seed => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (r, list) => list[(r() * list.length) | 0];

  const block = (c, x, y, w, h, colour) => {
    c.fillStyle = colour;
    c.fillRect(x, y, w, h);
    const g = c.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, 'rgba(255,255,255,.12)');
    g.addColorStop(1, 'rgba(0,0,0,.12)');
    c.fillStyle = g;
    c.fillRect(x, y, w, h);
  };

  const SURFACES = {
    patio(c, W, H, r) {
      c.fillStyle = '#7d7567';
      c.fillRect(0, 0, W, H);
      const rows = 5, rh = H / rows, gap = Math.max(2, W * 0.008);
      const pal = ['#d8ccb6', '#cdbfa8', '#c4b69f', '#ded3c1', '#b9ac96', '#d2c4aa'];
      for (let i = 0; i < rows; i++) {
        for (let x = -r() * rh; x < W;) {
          const sw = rh * (0.8 + r() * 1.1);
          block(c, x + gap / 2, i * rh + gap / 2, sw - gap, rh - gap, pick(r, pal));
          x += sw;
        }
      }
    },
    drive(c, W, H, r) {
      c.fillStyle = '#34312f';
      c.fillRect(0, 0, W, H);
      const bw = W / 6.5, bh = bw / 2, gap = Math.max(1.5, W * 0.005);
      const pal = ['#8a7f78', '#7a706a', '#96877c', '#6c6562', '#a08f80', '#7f7771'];
      for (let i = 0; i * bh < H; i++) {
        for (let x = i % 2 ? -bw / 2 : 0; x < W; x += bw) {
          block(c, x + gap / 2, i * bh + gap / 2, bw - gap, bh - gap, pick(r, pal));
        }
      }
    },
    roof(c, W, H, r) {
      c.fillStyle = '#4a261c';
      c.fillRect(0, 0, W, H);
      const tw = W / 6.5, th = H / 7.5;
      const pal = ['#a9573f', '#9c4e39', '#b4624a', '#914834', '#a35a45'];
      for (let i = 0; i * th < H; i++) {
        for (let x = i % 2 ? -tw / 2 : 0; x < W; x += tw) {
          const y = i * th;
          block(c, x + 1, y, tw - 2, th, pick(r, pal));
          const g = c.createLinearGradient(0, y + th * 0.62, 0, y + th);
          g.addColorStop(0, 'rgba(0,0,0,0)');
          g.addColorStop(1, 'rgba(0,0,0,.42)');
          c.fillStyle = g;
          c.fillRect(x + 1, y, tw - 2, th);
          c.fillStyle = 'rgba(255,255,255,.14)';
          c.fillRect(x + 1, y, tw - 2, Math.max(1, th * 0.03));
        }
      }
    }
  };

  function initWash(root) {
    const surface = $('.wash__surface', root), grime = $('.wash__grime', root);
    const sctx = surface.getContext('2d'), gctx = grime.getContext('2d');
    const pctEl = $('.wash__pct b', root), nozzle = $('.wash__nozzle', root), hud = $('.wash__hud', root);
    const probe = document.createElement('canvas');
    probe.width = probe.height = 24;
    const pctx = probe.getContext('2d', { willReadFrequently: true });

    let W = 0, H = 0, dpr = 1, cssW = 0, R = 30, brush = null;
    let type = 'patio', base = 1, last = null, touched = false, done = false, probedAt = 0;

    const makeBrush = r => {
      const c = document.createElement('canvas');
      c.width = c.height = r * 2;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(r, r, r * 0.2, r, r, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.65, 'rgba(0,0,0,.8)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, r * 2, r * 2);
      return c;
    };

    const coverage = () => {
      pctx.clearRect(0, 0, 24, 24);
      pctx.drawImage(grime, 0, 0, 24, 24);
      const d = pctx.getImageData(0, 0, 24, 24).data;
      let sum = 0;
      for (let i = 3; i < d.length; i += 4) sum += d[i];
      return sum / (24 * 24 * 255);
    };

    const paintGrime = r => {
      gctx.globalCompositeOperation = 'source-over';
      gctx.clearRect(0, 0, W, H);
      gctx.fillStyle = 'rgba(30,36,24,.8)';
      gctx.fillRect(0, 0, W, H);
      const tones = ['38,54,24', '58,70,30', '16,18,12', '74,84,40', '24,30,20'];
      for (let i = 0; i < 120; i++) {
        const x = r() * W, y = r() * H, rad = W * (0.05 + r() * 0.16), t = pick(r, tones);
        const g = gctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, `rgba(${t},${0.35 + r() * 0.4})`);
        g.addColorStop(1, `rgba(${t},0)`);
        gctx.fillStyle = g;
        gctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      for (let i = 0; i < 320; i++) {
        gctx.fillStyle = r() > 0.5 ? 'rgba(150,160,104,.55)' : 'rgba(205,205,175,.4)';
        gctx.beginPath();
        gctx.arc(r() * W, r() * H, (0.6 + r() * 2.6) * dpr, 0, 7);
        gctx.fill();
      }
      gctx.globalCompositeOperation = 'destination-out';
    };

    const show = pct => {
      pctEl.textContent = Math.round(pct * 100);
      hud.style.setProperty('--p', pct.toFixed(3));
    };

    const build = () => {
      const box = root.getBoundingClientRect();
      cssW = box.width;
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = surface.width = grime.width = Math.round(box.width * dpr);
      H = surface.height = grime.height = Math.round(box.height * dpr);
      R = Math.round(Math.max(26, box.width * 0.075) * dpr);
      brush = makeBrush(R);
      SURFACES[type](sctx, W, H, rng(7));
      paintGrime(rng(21));
      base = coverage() || 1;
      done = false;
      last = null;
      root.classList.remove('is-done');
      show(0);
    };

    const dab = (x, y, k = 1) => gctx.drawImage(brush, x - R * k, y - R * k, R * 2 * k, R * 2 * k);
    const stroke = (a, b, k = 1) => {
      const dx = b.x - a.x, dy = b.y - a.y;
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (R * 0.3)));
      for (let i = 1; i <= steps; i++) dab(a.x + (dx * i) / steps, a.y + (dy * i) / steps, k);
    };

    const check = force => {
      const now = performance.now();
      if (!force && now - probedAt < 160) return;
      probedAt = now;
      const pct = Math.min(1, Math.max(0, 1 - coverage() / base));
      if (pct >= 0.9 && !done) {
        done = true;
        root.classList.add('is-done');
        show(1);
      } else if (!done) show(pct);
    };

    const at = e => {
      const b = grime.getBoundingClientRect();
      return { x: (e.clientX - b.left) * dpr, y: (e.clientY - b.top) * dpr, cx: e.clientX - b.left, cy: e.clientY - b.top };
    };

    root.addEventListener('pointermove', e => {
      const p = at(e);
      nozzle.style.transform = `translate(${p.cx}px, ${p.cy}px)`;
      root.classList.add('is-live');
      if (done || e.target.closest('button')) { last = null; return; }
      touched = true;
      if (last) stroke(last, p); else dab(p.x, p.y);
      last = p;
      check();
    });
    const lift = () => { last = null; root.classList.remove('is-live'); if (touched) check(true); };
    ['pointerleave', 'pointerup', 'pointercancel'].forEach(ev => root.addEventListener(ev, lift));

    $$('.wash__tabs button', root).forEach(btn => btn.addEventListener('click', () => {
      type = btn.dataset.surface;
      $$('.wash__tabs button', root).forEach(b => b.setAttribute('aria-pressed', b === btn));
      build();
    }));
    $('.wash__reset', root).addEventListener('click', build);

    /* One opening pass along the arc of the logo's swoosh, to show what the pane does. */
    const arc = t => ({ x: W * (0.08 + 0.84 * t), y: H * (0.74 - 0.44 * Math.sin(Math.PI * t * 0.86)) });
    const demo = () => {
      if (touched) return;
      if (reduce) {
        for (let i = 1; i <= 40; i++) stroke(arc((i - 1) / 40), arc(i / 40), 1.3);
        return check(true);
      }
      const t0 = performance.now(), dur = 1300;
      let prev = arc(0);
      const step = now => {
        if (touched) return;
        const t = Math.min((now - t0) / dur, 1);
        const p = arc(t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
        stroke(prev, p, 1.3);
        prev = p;
        check();
        if (t < 1) requestAnimationFrame(step); else check(true);
      };
      requestAnimationFrame(step);
    };

    build();
    setTimeout(demo, reduce ? 0 : 1700);

    let timer;
    new ResizeObserver(() => {
      if (Math.abs(root.getBoundingClientRect().width - cssW) < 2) return;
      clearTimeout(timer);
      timer = setTimeout(build, 150);
    }).observe(root);
  }
  const wash = $('#wash');
  if (wash) initWash(wash);

  /* ---------- services: the house diagram and the list drive each other ---------- */
  const svc = $('#svc');
  if (svc) {
    const items = $$('.svc__item', svc), parts = $$('.part', svc), cap = $('#svc-cap');
    let active = 'roof';
    const light = name => parts.forEach(p => p.classList.toggle('is-active', p.dataset.part === name));
    const open = name => {
      active = name;
      items.forEach(i => {
        const on = i.dataset.part === name;
        i.classList.toggle('is-active', on);
        $('button', i).setAttribute('aria-expanded', on);
        if (on) cap.textContent = $('.svc__name', i).textContent;
      });
      light(name);
    };
    items.forEach(i => {
      const b = $('button', i);
      b.addEventListener('click', () => open(i.dataset.part));
      b.addEventListener('pointerenter', () => light(i.dataset.part));
      b.addEventListener('focus', () => light(i.dataset.part));
      b.addEventListener('pointerleave', () => light(active));
      b.addEventListener('blur', () => light(active));
    });
    parts.forEach(p => ['pointerenter', 'click'].forEach(ev => p.addEventListener(ev, () => open(p.dataset.part))));
    open(active);
  }

  /* ---------- about: career timeline fills as you scroll it ---------- */
  const tl = $('.tl');
  if (tl) {
    const rows = $$('.tl__item', tl);
    let queued = false;
    const paint = () => {
      queued = false;
      const mark = innerHeight * 0.7, box = tl.getBoundingClientRect();
      tl.style.setProperty('--p', Math.min(1, Math.max(0, (mark - box.top) / box.height)).toFixed(3));
      rows.forEach(r => r.classList.toggle('is-on', r.getBoundingClientRect().top + 30 < mark));
    };
    const request = () => { if (!queued) { queued = true; requestAnimationFrame(paint); } };
    addEventListener('scroll', request, { passive: true });
    addEventListener('resize', request);
    paint();
  }

  /* ---------- quote form: hands the details to the visitor's email app ---------- */
  const form = $('#quote-form');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const d = new FormData(form);
      const body = [
        `Name: ${d.get('name')}`,
        `Phone: ${d.get('phone')}`,
        `Postcode: ${d.get('postcode')}`,
        `Service: ${d.get('service')}`,
        '',
        d.get('message') || ''
      ].join('\n');
      location.href = `mailto:${form.dataset.to}?subject=${encodeURIComponent(`Quote request — ${d.get('service')}`)}&body=${encodeURIComponent(body)}`;
    });
  }
})();
