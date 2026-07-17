// ─── Reveal en scroll (data-aos → .in-view) ─────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -80px 0px' });

  document.querySelectorAll('[data-aos]').forEach(el => observer.observe(el));
});

// ─── Parallax del hero ──────────────────────────────────────────────────
(() => {
  const heroBg = document.getElementById('heroBg');
  if (!heroBg) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let ticking = false;
  function update() {
    const y = window.pageYOffset;
    heroBg.style.transform = `translate3d(0, ${y * 0.4}px, 0)`;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
})();

// ─── Carrusel de deportes en el hero ───────────────────────────────────
(() => {
  const slides = document.querySelectorAll('.hero-slide');
  const indicator = document.getElementById('heroIndicator');
  const fill = document.getElementById('heroIndicatorFill');
  if (!slides.length) return;

  const counter = indicator?.querySelector('.hero-indicator__counter');
  const name = indicator?.querySelector('.hero-indicator__name');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const INTERVAL_MS = 5000;
  const TICK_MS = 50;

  let current = 0;
  let progress = 0;
  let progressTimer = null;

  function pad(n) { return String(n).padStart(2, '0'); }

  function showSlide(idx) {
    slides.forEach((s, i) => s.classList.toggle('is-active', i === idx));
    if (counter) counter.textContent = `${pad(idx + 1)} / ${pad(slides.length)}`;
    if (name) {
      const dep = slides[idx].dataset.deporte || '';
      name.textContent = dep.toUpperCase();
    }
  }

  function next() {
    current = (current + 1) % slides.length;
    showSlide(current);
    progress = 0;
    if (fill) fill.style.width = '0%';
  }

  showSlide(0);

  if (reduceMotion) return; // sin auto-play

  // tick que avanza la barra y dispara next() al llenar
  progressTimer = setInterval(() => {
    progress += (TICK_MS / INTERVAL_MS) * 100;
    if (fill) fill.style.width = Math.min(100, progress) + '%';
    if (progress >= 100) next();
  }, TICK_MS);

  // pausar al hover sobre el indicador (UX sutil)
  indicator?.addEventListener('mouseenter', () => clearInterval(progressTimer));
})();

// ─── Mobile menu ────────────────────────────────────────────────────────
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const navLinks = document.querySelector('.nav-links');

if (mobileMenuBtn && navLinks) {
  mobileMenuBtn.addEventListener('click', () => {
    navLinks.classList.toggle('is-open');
    mobileMenuBtn.classList.toggle('is-open');
  });
}

// ─── Smooth scroll para anchors ────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offsetTop = target.getBoundingClientRect().top + window.pageYOffset - 80;
    window.scrollTo({ top: offsetTop, behavior: 'smooth' });
    if (navLinks?.classList.contains('is-open')) {
      navLinks.classList.remove('is-open');
      mobileMenuBtn?.classList.remove('is-open');
    }
  });
});

// ─── Toast (notificaciones del form) ───────────────────────────────────
function showToast(message, type = 'success') {
  document.getElementById('clubix-toast')?.remove();
  const toast = document.createElement('div');
  toast.id = 'clubix-toast';
  toast.className = `clubix-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ─── Contact form ──────────────────────────────────────────────────────
const contactForm = document.querySelector('.contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const original = submitBtn.textContent;
    submitBtn.textContent = 'Enviando...';
    submitBtn.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(contactForm));
      const res = await fetch('https://formspree.io/f/mvzvljyq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Error');
      showToast('Recibido. Te contactamos pronto.', 'success');
      contactForm.reset();
    } catch {
      showToast('Hubo un error. Intentá nuevamente.', 'error');
    } finally {
      submitBtn.textContent = original;
      submitBtn.disabled = false;
    }
  });
}

// ─── Estilos del toast (inline para no tocar styles.css) ───────────────
const toastStyle = document.createElement('style');
toastStyle.textContent = `
  .clubix-toast {
    position: fixed;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    padding: 14px 24px;
    background: var(--ink);
    color: var(--bg);
    font-family: var(--font-mono);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    border-left: 3px solid var(--accent);
    opacity: 0;
    transition: opacity 0.3s ease, transform 0.3s ease;
    z-index: 9999;
    pointer-events: none;
  }
  .clubix-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  .clubix-toast.error { border-left-color: #DC2626; }
`;
document.head.appendChild(toastStyle);
