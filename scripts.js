function updateHue(hue) {
  document.querySelectorAll('.hue-slider').forEach(s => s.value = hue);
  document.documentElement.style.setProperty('--hue', hue);
}

updateHue(Math.floor(Math.random() * 360));

document.querySelectorAll('.hue-slider').forEach(slider => {
  slider.addEventListener('input', function () {
    updateHue(this.value);
  });
});

// Language toggle — cycles EN → SV → NL → EN
const LANGS = ['en', 'sv', 'nl'];
let lang = localStorage.getItem('emmait-lang');
if (!LANGS.includes(lang)) lang = 'en';

function nextLang() {
  return LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length];
}

function applyLang(l) {
  lang = l;
  localStorage.setItem('emmait-lang', l);
  document.documentElement.lang = l;
  document.querySelectorAll('[data-sv]').forEach(el => {
    const val = el.dataset[l];
    if (!val) return;
    if (el.tagName === 'INPUT') {
      el.placeholder = val;
    } else {
      el.textContent = val;
    }
  });
  document.querySelectorAll('.lang-toggle').forEach(btn => {
    btn.textContent = nextLang().toUpperCase();
  });
}

document.querySelectorAll('.lang-toggle').forEach(btn =>
  btn.addEventListener('click', () => applyLang(nextLang())));

applyLang(lang);

// Active nav link via IntersectionObserver
const navLinks = document.querySelectorAll('.nav-link');
const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(l => l.classList.remove('active'));
      const link = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
      if (link) link.classList.add('active');
    }
  });
}, { threshold: 0.4 });
document.querySelectorAll('section[id]').forEach(s => sectionObserver.observe(s));

// Smart search — browser-address-bar-style autocomplete over DuckDuckGo + localStorage history
(function initSmartSearch() {
  const form = document.querySelector('.navbar-search');
  if (!form) return;
  const input = form.querySelector('input[name="q"]');
  const dropdown = form.querySelector('.search-suggestions');
  if (!input || !dropdown) return;

  const HISTORY_KEY = 'emmait-search-history';
  const MAX_HISTORY = 30;
  const MAX_SUGGESTIONS = 8;
  const DEBOUNCE_MS = 150;
  const MIN_CHARS = 2;
  // Cloudflare Worker proxy — DDG's ac/ endpoint does not send CORS headers.
  // Replace after deploying _cloudflare-worker/ddg-ac.js.
  const AC_ENDPOINT = 'https://ddg-ac.avid-hunch-4l.workers.dev/';

  let history = [];
  try { history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { history = []; }

  let suggestions = [];
  let activeIndex = -1;
  let abortCtrl = null;
  let debounceId = 0;

  function looksLikeUrl(v) {
    if (/^https?:\/\//i.test(v)) return true;
    if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/.*)?$/.test(v)) return true;
    if (/^localhost(:\d+)?([/?].*)?$/i.test(v)) return true;
    if (/^[a-z0-9-]+(\.[a-z]{2,})+([/?].*)?$/i.test(v) && !v.includes(' ')) return true;
    return false;
  }

  function toUrl(v) {
    if (/^https?:\/\//i.test(v)) return v;
    if (/^\d/.test(v) || /^localhost/i.test(v)) return 'http://' + v;
    return 'https://' + v;
  }

  function saveHistory(val) {
    const trimmed = val.trim();
    if (!trimmed) return;
    history = [trimmed, ...history.filter(h => h.toLowerCase() !== trimmed.toLowerCase())]
      .slice(0, MAX_HISTORY);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
  }

  function dedupe(arr) {
    const seen = new Set();
    const out = [];
    for (const s of arr) {
      const k = s.toLowerCase();
      if (!seen.has(k)) { seen.add(k); out.push(s); }
    }
    return out;
  }

  function render() {
    dropdown.textContent = '';
    if (!suggestions.length) {
      dropdown.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      return;
    }
    suggestions.forEach((s, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.textContent = s;
      if (i === activeIndex) {
        li.classList.add('active');
        li.setAttribute('aria-selected', 'true');
      }
      li.addEventListener('mousedown', e => {
        e.preventDefault();
        input.value = s;
        form.requestSubmit();
      });
      dropdown.appendChild(li);
    });
    dropdown.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function matchHistory(q) {
    if (!q) return history.slice(0, MAX_SUGGESTIONS);
    const ql = q.toLowerCase();
    return history.filter(h => h.toLowerCase().startsWith(ql));
  }

  async function fetchDDG(q) {
    if (AC_ENDPOINT.includes('REPLACE-ME')) return [];
    if (abortCtrl) abortCtrl.abort();
    abortCtrl = new AbortController();
    try {
      const res = await fetch(
        AC_ENDPOINT + '?q=' + encodeURIComponent(q),
        { signal: abortCtrl.signal }
      );
      if (!res.ok) return [];
      const data = await res.json();
      if (Array.isArray(data) && data.length === 2 && Array.isArray(data[1])) return data[1];
      if (Array.isArray(data)) return data.map(x => (typeof x === 'string' ? x : x.phrase)).filter(Boolean);
      return [];
    } catch (err) {
      if (err.name !== 'AbortError') console.warn('DDG autocomplete failed', err);
      return [];
    }
  }

  function update(q) {
    activeIndex = -1;
    const histMatches = matchHistory(q);
    suggestions = dedupe(histMatches).slice(0, MAX_SUGGESTIONS);
    render();

    clearTimeout(debounceId);
    if (q.length < MIN_CHARS) return;
    debounceId = setTimeout(async () => {
      const ddg = await fetchDDG(q);
      if (input.value.trim() !== q) return;
      suggestions = dedupe([...histMatches, ...ddg]).slice(0, MAX_SUGGESTIONS);
      render();
    }, DEBOUNCE_MS);
  }

  input.addEventListener('input', () => update(input.value.trim()));
  input.addEventListener('focus', () => update(input.value.trim()));
  input.addEventListener('blur', () => setTimeout(() => {
    dropdown.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  }, 120));

  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') {
      if (!suggestions.length) return;
      activeIndex = (activeIndex + 1) % suggestions.length;
      render();
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      if (!suggestions.length) return;
      activeIndex = (activeIndex - 1 + suggestions.length) % suggestions.length;
      render();
      e.preventDefault();
    } else if (e.key === 'Escape') {
      suggestions = [];
      render();
    } else if (e.key === 'Tab' || e.key === 'ArrowRight') {
      const caretAtEnd = input.selectionStart === input.value.length
                       && input.selectionEnd === input.value.length;
      if (!caretAtEnd || !suggestions.length) return;
      const pick = activeIndex >= 0 ? suggestions[activeIndex] : suggestions[0];
      if (pick && pick !== input.value) {
        input.value = pick;
        update(pick);
        e.preventDefault();
      }
    }
  });

  form.addEventListener('submit', e => {
    const picked = activeIndex >= 0 ? suggestions[activeIndex] : null;
    if (picked) input.value = picked;
    const val = input.value.trim();
    if (!val) { e.preventDefault(); return; }
    saveHistory(val);
    if (looksLikeUrl(val)) {
      e.preventDefault();
      window.location.href = toUrl(val);
    }
  });
})();

// Mobile menu toggle
const hamburger = document.querySelector('.hamburger');
const mobileMenu = document.querySelector('.mobile-menu');
const navOverlay = document.querySelector('.nav-overlay');

function toggleMenu(open) {
  const isOpen = open ?? !mobileMenu.classList.contains('open');
  mobileMenu.classList.toggle('open', isOpen);
  navOverlay.classList.toggle('open', isOpen);
  hamburger.setAttribute('aria-expanded', String(isOpen));
}

hamburger.addEventListener('click', () => toggleMenu());
navOverlay.addEventListener('click', () => toggleMenu(false));
document.querySelector('.nav-close').addEventListener('click', () => toggleMenu(false));
document.querySelectorAll('.mobile-menu .nav-link').forEach(l =>
  l.addEventListener('click', () => toggleMenu(false)));
