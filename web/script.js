// Scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('aos-animate');
        }
    });
}, observerOptions);

// Observe all elements with data-aos attribute
document.addEventListener('DOMContentLoaded', () => {
    const animatedElements = document.querySelectorAll('[data-aos]');
    animatedElements.forEach(el => observer.observe(el));
});

// Navbar scroll effect
let lastScroll = 0;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
});

// Parallax effect
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const parallaxBg = document.querySelector('.parallax-bg');
    const parallaxImages = document.querySelectorAll('.parallax-image');

    if (parallaxBg) {
        parallaxBg.style.transform = `translateY(${scrolled * 0.5}px)`;
    }

    parallaxImages.forEach(img => {
        const rect = img.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
            const offset = (window.innerHeight - rect.top) * 0.3;
            img.style.backgroundPositionY = `${offset}px`;
        }
    });
});

// Mobile menu toggle
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const navLinks = document.querySelector('.nav-links');

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        mobileMenuBtn.classList.toggle('active');
    });
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));

        if (target) {
            const offsetTop = target.offsetTop - 80;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });

            // Close mobile menu if open
            if (navLinks.classList.contains('active')) {
                navLinks.classList.remove('active');
                mobileMenuBtn.classList.remove('active');
            }
        }
    });
});

// ── Feature cards: 3D tilt + cursor glow ─────────────────
document.addEventListener('DOMContentLoaded', () => {
    const tiltCards = document.querySelectorAll('[data-tilt]');

    tiltCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect   = card.getBoundingClientRect();
            const x      = e.clientX - rect.left;
            const y      = e.clientY - rect.top;
            const cx     = rect.width  / 2;
            const cy     = rect.height / 2;
            const dx     = (x - cx) / cx;   // -1 … +1
            const dy     = (y - cy) / cy;
            const tiltX  = -dy * 8;          // ±8°
            const tiltY  =  dx * 8;
            card.style.transform = `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateZ(4px)`;
            // brillo que sigue al cursor
            card.style.setProperty('--mx', `${(x / rect.width)  * 100}%`);
            card.style.setProperty('--my', `${(y / rect.height) * 100}%`);
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });
});

// ── Parallax sutil en el fondo de features ───────────────
window.addEventListener('scroll', () => {
    const bg = document.querySelector('.features-parallax-bg');
    if (!bg) return;
    const section = bg.closest('.features');
    if (!section) return;
    const rect   = section.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;
    const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
    bg.style.transform = `translateY(${(progress - 0.5) * 80}px)`;
}, { passive: true });

// Contact form submission
const contactForm = document.querySelector('.contact-form');

if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(contactForm);
        const data = Object.fromEntries(formData);

        // Show loading state
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Enviando...';
        submitBtn.disabled = true;

        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Show success message
            alert('¡Gracias! Nos pondremos en contacto contigo pronto.');
            contactForm.reset();
        } catch (error) {
            alert('Hubo un error. Por favor intenta nuevamente.');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}

// Number counter animation
const animateCounter = (element, target, duration = 2000) => {
    let current = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 16);
};

// Trigger counter animation when stats are visible
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const statNumbers = entry.target.querySelectorAll('.stat-number');
            statNumbers.forEach(stat => {
                const text = stat.textContent;
                const isPercentage = text.includes('%');
                const number = parseInt(text.replace(/\D/g, ''));

                if (number) {
                    stat.textContent = '0' + (isPercentage ? '%' : '');
                    animateCounter(stat, number, 2000);
                    if (isPercentage) {
                        const interval = setInterval(() => {
                            if (!stat.textContent.includes('%')) {
                                stat.textContent += '%';
                                clearInterval(interval);
                            }
                        }, 100);
                    }
                }
            });
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const statsBar = document.querySelector('.stats-bar');
if (statsBar) {
    statsObserver.observe(statsBar);
}

// Add hover effect to cards
const cards = document.querySelectorAll('.feature-card, .module-card, .pricing-card');

cards.forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-8px)';
    });

    card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
    });
});

// Lazy load images
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    observer.unobserve(img);
                }
            }
        });
    });

    document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
    });
}

// Add entrance animation to hero
window.addEventListener('load', () => {
    const heroText = document.querySelector('.hero-text');
    const heroImage = document.querySelector('.hero-image');

    if (heroText) {
        setTimeout(() => {
            heroText.style.opacity = '1';
            heroText.style.transform = 'translateY(0)';
        }, 100);
    }

    if (heroImage) {
        setTimeout(() => {
            heroImage.style.opacity = '1';
            heroImage.style.transform = 'translateX(0)';
        }, 300);
    }
});

// Add ripple effect to buttons
document.querySelectorAll('.btn-primary, .btn-secondary').forEach(button => {
    button.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple');

        this.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
    });
});

// Add CSS for ripple effect
const style = document.createElement('style');
style.textContent = `
    .btn-primary, .btn-secondary {
        position: relative;
        overflow: hidden;
    }

    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.6);
        transform: scale(0);
        animation: ripple-animation 0.6s ease-out;
        pointer-events: none;
    }

    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }

    .nav-links.active {
        display: flex;
        flex-direction: column;
        position: absolute;
        top: 80px;
        left: 0;
        right: 0;
        background: white;
        padding: 20px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    }

    .mobile-menu-btn.active span:nth-child(1) {
        transform: rotate(45deg) translate(8px, 8px);
    }

    .mobile-menu-btn.active span:nth-child(2) {
        opacity: 0;
    }

    .mobile-menu-btn.active span:nth-child(3) {
        transform: rotate(-45deg) translate(7px, -7px);
    }

    .hero-text, .hero-image {
        opacity: 0;
        transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .hero-text {
        transform: translateY(30px);
    }

    .hero-image {
        transform: translateX(30px);
    }
`;
document.head.appendChild(style);

// Console message
console.log('%cClubix', 'font-size: 48px; font-weight: bold; background: linear-gradient(135deg, #3B9FF3, #00D4D4); -webkit-background-clip: text; -webkit-text-fill-color: transparent;');
console.log('%c¡Gracias por visitar nuestro sitio!', 'font-size: 16px; color: #3B9FF3;');
console.log('%cSistema de gestión integral para clubes deportivos', 'font-size: 14px; color: #6B7280;');
