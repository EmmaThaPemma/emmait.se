const hueSlider = document.getElementById('hue-slider');

function updateHue(hue) {
  hueSlider.value = hue;
  document.documentElement.style.setProperty('--hue', hue);
}

const savedHue = localStorage.getItem('emmait-hue');
if (savedHue) updateHue(savedHue);

hueSlider.addEventListener('input', function () {
  updateHue(hueSlider.value);
  localStorage.setItem('emmait-hue', hueSlider.value);
});

// Language toggle — cycles EN → SV → NL → EN
const LANGS = ['en', 'sv', 'nl'];
let lang = localStorage.getItem('emmait-lang') || 'en';

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

// Smart search — navigate directly to URLs/IPs, otherwise DuckDuckGo
function looksLikeUrl(val) {
  if (/^https?:\/\//i.test(val)) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/.*)?$/.test(val)) return true;
  if (/^[a-z0-9-]+(\.[a-z]{2,})+([/?].*)?$/i.test(val) && !val.includes(' ')) return true;
  return false;
}

document.querySelector('.navbar-search').addEventListener('submit', function (e) {
  const val = this.querySelector('input[name="q"]').value.trim();
  if (looksLikeUrl(val)) {
    e.preventDefault();
    const url = /^https?:\/\//i.test(val) ? val
              : /^\d/.test(val) ? 'http://' + val
              : 'https://' + val;
    window.open(url, '_blank');
  }
});

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
