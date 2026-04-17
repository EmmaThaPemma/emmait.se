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

// Bilingual toggle
let lang = localStorage.getItem('emmait-lang') || 'sv';

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
    btn.textContent = l === 'sv' ? 'EN' : 'SV';
  });
}

document.querySelectorAll('.lang-toggle').forEach(btn =>
  btn.addEventListener('click', () => applyLang(lang === 'sv' ? 'en' : 'sv')));

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
