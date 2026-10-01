(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- theme: light by default, the visitor's choice is remembered ---------- */
  const themeBtn = $('#theme');
  const themeMeta = $('meta[name="theme-color"]');
  const paintTheme = t => {
    root.dataset.theme = t;
    themeBtn.setAttribute('aria-pressed', t === 'dark');
    themeMeta.content = t === 'dark' ? '#0a0f16' : '#f4f7fa';
  };
  paintTheme(root.dataset.theme || 'light');

  themeBtn.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('mnnj-theme', next); } catch (e) { /* private mode: the choice just lasts for this page */ }
    if (!document.startViewTransition || reduce) return paintTheme(next);

    // The new theme opens out in a circle from the button that was pressed.
    const b = themeBtn.getBoundingClientRect();
    const x = b.left + b.width / 2, y = b.top + b.height / 2;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add('theme-anim');
    const vt = document.startViewTransition(() => paintTheme(next));
    vt.ready.then(() => root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 600, easing: 'cubic-bezier(.4, 0, .2, 1)', pseudoElement: '::view-transition-new(root)' }
    ));
    vt.finished.finally(() => root.classList.remove('theme-anim'));
  });

  /* ---------- nav ---------- */
  const nav = $('#nav');
  const toggle = $('.nav__toggle');
  const onScroll = () => nav.classList.toggle('nav--stuck', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const setMenu = open => {
    nav.classList.toggle('nav--open', open);
    toggle.setAttribute('aria-expanded', open);
  };
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('nav--open')));
  $$('.nav__links a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && nav.classList.contains('nav--open')) { setMenu(false); toggle.focus(); }
  });

  $$('[data-year]').forEach(el => (el.textContent = new Date().getFullYear()));

  /* ---------- scroll reveal ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(({ isIntersecting, target }) => {
      if (!isIntersecting) return;
      target.classList.add('is-in');
      io.unobserve(target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  $$('[data-reveal]').forEach(el => io.observe(el));

  /* ---------- before / after ---------- */
  const cmp = $('#cmp');
  if (cmp) {
    const range = $('.cmp__range', cmp);
    let touched = false;
    const set = v => cmp.style.setProperty('--pos', v + '%');
    range.addEventListener('input', () => { touched = true; set(range.value); });
    set(range.value);

    // One slow sweep on arrival shows the handle moves; any input from the visitor cancels it.
    if (!reduce) {
      const keys = [[0, 50], [0.35, 76], [0.75, 30], [1, 50]];
      const ease = t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
      setTimeout(() => {
        const t0 = performance.now(), dur = 2600;
        const step = now => {
          if (touched) return;
          const t = Math.min((now - t0) / dur, 1);
          const i = keys.findIndex(k => k[0] >= t) || 1;
          const [ta, va] = keys[i - 1], [tb, vb] = keys[i];
          const v = va + (vb - va) * ease((t - ta) / (tb - ta));
          range.value = v;
          set(v);
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }, 1500);
    }
  }


  /* ---------- photo backgrounds: load when near ---------- */
  const photoIO = new IntersectionObserver(entries => entries.forEach(({ isIntersecting, target: el }) => {
    if (!isIntersecting || el.dataset.loaded) return;
    el.dataset.loaded = '1';
    const file = innerWidth < 900 ? el.dataset.photo.replace(/\.webp$/, '-sm.webp') : el.dataset.photo;
    const src = new URL(file, location.href).href;
    const img = new Image();
    img.src = src;
    img.decode().catch(() => {}).finally(() => {
      el.style.setProperty('--photo', `url("${src}")`);
      el.classList.add('photo-ready');
    });
  }), { rootMargin: '300px 0px' });
  $$('[data-photo]').forEach(el => photoIO.observe(el));

  /* ---------- before / after lens: peek under the pointer, tap to open from that spot ---------- */
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  $$('[data-lens]').forEach(lens => {
    const btn = $('.lens__btn', lens), tag = $('.lens__tag', lens);
    let open = false;
    const aim = e => {
      const b = lens.getBoundingClientRect();
      lens.style.setProperty('--x', (e.clientX - b.left).toFixed(0) + 'px');
      lens.style.setProperty('--y', (e.clientY - b.top).toFixed(0) + 'px');
    };
    const setOpen = (value, e) => {
      open = value;
      if (e) aim(e); else { lens.style.setProperty('--x', '50%'); lens.style.setProperty('--y', '50%'); }
      lens.classList.toggle('is-open', open);
      btn.setAttribute('aria-pressed', open);
      btn.textContent = open ? 'Show before' : 'Show after';
      tag.textContent = open ? 'After' : 'Before';
    };
    if (finePointer && !reduce) {
      lens.addEventListener('pointerenter', e => { aim(e); lens.classList.add('is-peek'); });
      lens.addEventListener('pointermove', e => { if (!open) aim(e); });
      lens.addEventListener('pointerleave', () => lens.classList.remove('is-peek'));
    }
    lens.addEventListener('click', e => { if (!e.target.closest('.lens__btn')) setOpen(!open, e); });
    btn.addEventListener('click', () => setOpen(!open));
  });

  /* ---------- services filter ---------- */
  const cards = $('#cards');
  if (cards) {
    const chips = $$('.chip[data-filter]');
    const apply = f => {
      chips.forEach(c => c.setAttribute('aria-pressed', c.dataset.filter === f));
      $$('.card', cards).forEach(c => {
        c.hidden = f !== 'all' && c.dataset.pillar !== f;
        c.classList.add('is-in');
      });
    };
    chips.forEach(chip => chip.addEventListener('click', () => {
      const f = chip.dataset.filter;
      if (!document.startViewTransition || reduce) return apply(f);
      root.classList.add('is-filtering');
      document.startViewTransition(() => apply(f)).finished.finally(() => root.classList.remove('is-filtering'));
    }));
  }

  /* ---------- seasons: flag the one we're in ---------- */
  const month = new Date().getMonth();
  $$('.season').forEach(s => s.classList.toggle('is-now', s.dataset.months.split(',').map(Number).includes(month)));

  /* ---------- process: a ball is passed from step to step ---------- */
  const passes = $('#passes');
  if (passes) {
    const svg = $('.passes__arc', passes), path = $('path', svg), ball = $('.passes__ball', svg);
    const steps = $$('.step', passes), dots = $$('.step__n', passes);
    const wide = matchMedia('(min-width: 861px)');
    let xs = [], played = false;

    const layout = () => {
      const box = passes.getBoundingClientRect();
      svg.setAttribute('viewBox', `0 0 ${box.width} 70`);
      xs = dots.map(d => { const b = d.getBoundingClientRect(); return b.left - box.left + b.width / 2; });
      path.setAttribute('d', `M${xs[0]} 60Q${(xs[0] + xs[1]) / 2} -24 ${xs[1]} 60Q${(xs[1] + xs[2]) / 2} -24 ${xs[2]} 60`);
    };

    const play = () => {
      played = true;
      if (reduce || !wide.matches) {
        steps.forEach((s, i) => setTimeout(() => s.classList.add('is-on'), reduce ? 0 : i * 350));
        return;
      }
      layout();
      const total = path.getTotalLength(), t0 = performance.now(), dur = 2200;
      ball.style.opacity = 1;
      steps[0].classList.add('is-on');
      const step = now => {
        const t = Math.min((now - t0) / dur, 1);
        const p = path.getPointAtLength(total * t);
        ball.setAttribute('cx', p.x);
        ball.setAttribute('cy', p.y);
        if (p.x >= xs[1] - 4) steps[1].classList.add('is-on');
        if (t < 1) return requestAnimationFrame(step);
        steps[2].classList.add('is-on');
        ball.style.transition = 'opacity .4s';
        ball.style.opacity = 0;
      };
      requestAnimationFrame(step);
    };

    layout();
    addEventListener('resize', layout);
    new IntersectionObserver((entries, obs) => {
      if (entries[0].isIntersecting && !played) { play(); obs.disconnect(); }
    }, { threshold: 0.5 }).observe(passes);
  }

  /* ---------- owner card: leans toward the pointer ---------- */
  const pcard = $('#pcard');
  if (pcard && !reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const wrap = pcard.parentElement;
    wrap.addEventListener('pointermove', e => {
      const b = wrap.getBoundingClientRect();
      const px = (e.clientX - b.left) / b.width, py = (e.clientY - b.top) / b.height;
      pcard.classList.add('is-tilting');
      pcard.style.setProperty('--ry', ((px - 0.5) * 12).toFixed(2) + 'deg');
      pcard.style.setProperty('--rx', ((0.5 - py) * 10).toFixed(2) + 'deg');
      pcard.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
      pcard.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
    });
    wrap.addEventListener('pointerleave', () => {
      pcard.classList.remove('is-tilting');
      pcard.style.setProperty('--rx', '0deg');
      pcard.style.setProperty('--ry', '0deg');
    });
  }

  /* ---------- quote: three short steps instead of one long form ---------- */
  const form = $('#quote-form');
  if (form) {
    const steps = $$('.fstep', form);
    const back = $('[data-back]', form), next = $('[data-next]', form), send = $('[data-send]', form);
    const count = $('.form__count b', form), bar = $('.form__bar i', form);
    const progress = $('.form__progress', form), navRow = $('.form__nav', form), note = $('.form__note', form), done = $('.form__done', form);
    let at = 0;

    const show = (i, focus = true) => {
      at = i;
      steps.forEach((s, n) => s.classList.toggle('is-current', n === i));
      back.hidden = i === 0;
      next.hidden = i === steps.length - 1;
      send.hidden = i !== steps.length - 1;
      count.textContent = i + 1;
      bar.style.setProperty('--p', (i + 1) / steps.length);
      if (focus) $('.fstep__title', steps[i]).focus({ preventScroll: true });
    };

    const fail = (el, errId, message) => {
      $('#' + errId, form).textContent = message;
      if (el.matches('input, textarea')) el.setAttribute('aria-invalid', 'true');
      return el;
    };
    const clear = step => {
      $$('.err', step).forEach(e => (e.textContent = ''));
      $$('[aria-invalid]', step).forEach(e => e.removeAttribute('aria-invalid'));
    };

    // Returns the first control that needs attention, or null when the step is complete.
    const check = i => {
      const step = steps[i];
      clear(step);
      if (i === 0) {
        const boxes = $$('input[name="service"]', step);
        return boxes.some(b => b.checked) ? null : fail(boxes[0], 's1-err', 'Pick at least one — or choose “Not sure yet”.');
      }
      if (i === 1) {
        const pc = $('#q-postcode', step);
        return pc.value.trim() ? null : fail(pc, 'q-postcode-err', 'Add a postcode so we know where the job is.');
      }
      let first = null;
      const name = $('#q-name', step), phone = $('#q-phone', step);
      if (!name.value.trim()) first = fail(name, 'q-name-err', 'Add your name.');
      if ((phone.value.match(/\d/g) || []).length < 9) {
        fail(phone, 'q-phone-err', 'Add a phone number we can reach you on.');
        first = first || phone;
      }
      return first;
    };

    form.addEventListener('input', e => {
      const field = e.target.closest('.field, .fstep');
      if (field) clear(field);
    });
    next.addEventListener('click', () => {
      const bad = check(at);
      if (bad) return bad.focus();
      show(at + 1);
    });
    back.addEventListener('click', () => show(at - 1));

    form.addEventListener('submit', e => {
      e.preventDefault();
      for (let i = 0; i < steps.length; i++) {
        const bad = check(i);
        if (bad) { show(i, false); return bad.focus(); }
      }
      const d = new FormData(form);
      const services = d.getAll('service').join(', ');
      const body = [
        `Services: ${services}`,
        `Property: ${d.get('property') || 'Not given'}`,
        `Postcode: ${d.get('postcode')}`,
        '',
        `Name: ${d.get('name')}`,
        `Phone: ${d.get('phone')}`,
        '',
        d.get('notes') || ''
      ].join('\n');
      location.href = `mailto:${form.dataset.to}?subject=${encodeURIComponent('Quote request — ' + services)}&body=${encodeURIComponent(body)}`;

      steps.forEach(s => s.classList.remove('is-current'));
      [progress, navRow, note].forEach(el => (el.hidden = true));
      done.hidden = false;
      $('.fstep__title', done).focus({ preventScroll: true });
    });

    $('[data-restart]', form).addEventListener('click', () => {
      form.reset();
      done.hidden = true;
      [progress, navRow, note].forEach(el => (el.hidden = false));
      show(0);
    });

    show(0, false);
  }

  /* ---------- mobile action bar: up once the hero buttons are gone, down at the form ---------- */
  const dock = $('#dock');
  if (dock) {
    const seen = new Map();
    const update = () => dock.classList.toggle('is-up', ![...seen.values()].some(Boolean));
    const watch = new IntersectionObserver(entries => {
      entries.forEach(e => seen.set(e.target, e.isIntersecting));
      update();
    });
    [$('.hero__cta'), $('#quote'), $('.footer')].filter(Boolean).forEach(el => watch.observe(el));
  }
})();
