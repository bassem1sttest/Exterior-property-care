/* Design switcher shared by both designs.
   Include on every page with data-design="1" (project root) or data-design="2" (v2/).
   Swapping keeps the same page and, where both designs have it, the same section. */
(() => {
  const script = document.currentScript;
  const design = script.dataset.design === '2' ? '2' : '1';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const file = location.pathname.split('/').pop() || 'index.html';
  const urls = design === '1' ? { 1: file, 2: 'v2/' + file } : { 1: '../' + file, 2: file };
  const sharedSections = ['services', 'process', 'owner', 'quote', 'career'];

  document.documentElement.dataset.ds = design;

  const style = document.createElement('style');
  style.textContent = `
    .ds { position: fixed; left: 16px; bottom: 16px; z-index: 60; display: flex; align-items: center; gap: 2px;
      padding: 4px 4px 4px 16px; border-radius: 999px; font-family: inherit; font-size: 15px; font-weight: 600; line-height: 1;
      background: rgba(255, 255, 255, .94); color: #0f1c2a; border: 1px solid #d3dce6;
      box-shadow: 0 12px 32px -14px rgba(15, 28, 42, .45);
      backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
    [data-theme="dark"] .ds { background: rgba(17, 24, 34, .94); color: #e8edf3; border-color: #2c3a4b; box-shadow: 0 12px 32px -14px rgba(0, 0, 0, .8); }
    .ds__label { margin-right: 10px; color: #4d5b69; }
    [data-theme="dark"] .ds__label { color: #a3b0be; }
    .ds__opt { position: relative; z-index: 1; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%;
      color: inherit; text-decoration: none; transition: color .25s; }
    .ds__opt:hover { background: rgba(11, 102, 195, .1); }
    .ds__opt.is-on { color: #fff; background: none; }
    [data-theme="dark"] .ds__opt.is-on { color: #04121f; }
    .ds__opt:focus-visible { outline: 3px solid #0b66c3; outline-offset: 2px; }
    .ds__thumb { position: absolute; top: 4px; left: 0; width: 44px; height: 44px; border-radius: 50%; background: #0b66c3;
      transition: left .3s cubic-bezier(.2, .7, .2, 1); }
    [data-theme="dark"] .ds__thumb { background: #3d9eff; }
    .footer { padding-bottom: 96px !important; }
    @media (max-width: 860px) {
      [data-ds="2"] .ds { bottom: 88px; }
      [data-ds="2"] .footer { padding-bottom: 176px !important; }
    }
    @media (prefers-reduced-motion: reduce) { .ds__thumb { transition: none; } }
    @media print { .ds { display: none; } }
  `;
  document.head.append(style);

  const nav = document.createElement('nav');
  nav.className = 'ds';
  nav.setAttribute('aria-label', 'Design version');
  nav.innerHTML =
    '<span class="ds__thumb" aria-hidden="true"></span>' +
    '<span class="ds__label" aria-hidden="true">Design</span>' +
    ['1', '2'].map(n =>
      `<a class="ds__opt${n === design ? ' is-on' : ''}" href="${urls[n]}"${n === design ? ' aria-current="page"' : ''} aria-label="Design ${n}">${n}</a>`
    ).join('');
  document.body.append(nav);

  const thumb = nav.querySelector('.ds__thumb');
  const links = [...nav.querySelectorAll('.ds__opt')];
  const place = a => (thumb.style.left = a.offsetLeft + 'px');
  place(links[+design - 1]);

  // The section the visitor is reading, if the other design has it too.
  const currentSection = () => {
    let found = '';
    for (const id of sharedSections) {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= innerHeight * 0.4) found = id;
    }
    return found && scrollY > 200 ? '#' + found : '';
  };

  nav.addEventListener('click', e => {
    const a = e.target.closest('.ds__opt');
    if (!a) return;
    e.preventDefault();
    if (a.classList.contains('is-on')) return;
    links.forEach(l => l.classList.toggle('is-on', l === a));
    place(a);
    const go = () => (location.href = a.getAttribute('href') + currentSection());
    reduce ? go() : setTimeout(go, 260);
  });
})();
