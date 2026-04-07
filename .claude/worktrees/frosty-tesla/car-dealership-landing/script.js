// ==================== COUNTDOWN TIMER ====================
function initCountdown() {
    // Set countdown to end of month (March 31, 2026)
    const endDate = new Date('2026-03-31T23:59:59').getTime();

    function updateCountdown() {
        const now = new Date().getTime();
        const distance = endDate - now;

        if (distance <= 0) {
            document.getElementById('days').textContent = '00';
            document.getElementById('hours').textContent = '00';
            document.getElementById('minutes').textContent = '00';
            document.getElementById('seconds').textContent = '00';
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        document.getElementById('days').textContent = String(days).padStart(2, '0');
        document.getElementById('hours').textContent = String(hours).padStart(2, '0');
        document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
        document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');

        // Pulse animation on seconds
        const secEl = document.getElementById('seconds');
        secEl.style.transition = 'transform 0.15s ease';
        secEl.style.transform = 'scale(1.15)';
        setTimeout(() => { secEl.style.transform = 'scale(1)'; }, 150);
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);
}

// ==================== ANIMATED COUNTER ====================
function animateCounters() {
    const counters = document.querySelectorAll('.stat-number');
    
    counters.forEach(counter => {
        const target = parseInt(counter.getAttribute('data-target'));
        const duration = 2000;
        const increment = target / (duration / 16);
        let current = 0;

        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                counter.textContent = target.toLocaleString();
                clearInterval(timer);
            } else {
                counter.textContent = Math.floor(current).toLocaleString();
            }
        }, 16);
    });
}

// ==================== SCROLL ANIMATIONS (AOS) ====================
function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const delay = entry.target.getAttribute('data-delay') || 0;
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, parseInt(delay));
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    document.querySelectorAll('[data-aos]').forEach(el => {
        observer.observe(el);
    });
}

// ==================== COUNTER ANIMATION ON SCROLL ====================
function initCounterOnScroll() {
    let triggered = false;
    const statsSection = document.querySelector('.hero-stats');
    
    if (!statsSection) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !triggered) {
                triggered = true;
                animateCounters();
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    observer.observe(statsSection);
}

// ==================== FORM SUBMISSION ====================
function handleSubmit(event) {
    event.preventDefault();
    
    const form = document.getElementById('leadForm');
    const submitBtn = document.getElementById('submitBtn');
    const successMsg = document.getElementById('successMessage');
    
    // Button loading state
    submitBtn.textContent = '⏳ Đang gửi...';
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';
    
    // Collect form data
    const formData = {
        name: document.getElementById('fullName').value,
        phone: document.getElementById('phone').value,
        email: document.getElementById('email').value,
        carInterest: document.getElementById('carInterest').value,
        package: document.getElementById('package').value,
        timestamp: new Date().toISOString()
    };
    
    // Simulate API call (replace with actual endpoint)
    setTimeout(() => {
        console.log('Lead submitted:', formData);
        
        // Show success message
        form.style.display = 'none';
        successMsg.style.display = 'flex';
        successMsg.style.animation = 'fadeInUp 0.5s ease-out';
        
        // Scroll to success message
        successMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 1500);
}

// ==================== STICKY HEADER SHADOW ON SCROLL ====================
function initStickyHeaderEffect() {
    const header = document.getElementById('stickyHeader');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            header.style.boxShadow = '0 4px 30px rgba(0, 0, 0, 0.5)';
        } else {
            header.style.boxShadow = 'none';
        }
    });
}

// ==================== SMOOTH SCROLL FOR CTA LINKS ====================
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

// ==================== PARALLAX EFFECT ON HERO ====================
function initParallax() {
    const hero = document.querySelector('.hero');
    
    window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;
        if (scrolled < window.innerHeight) {
            hero.style.backgroundPositionY = scrolled * 0.4 + 'px';
        }
    });
}

// ==================== INITIALIZE EVERYTHING ====================
document.addEventListener('DOMContentLoaded', () => {
    initCountdown();
    initScrollAnimations();
    initCounterOnScroll();
    initStickyHeaderEffect();
    initSmoothScroll();
    initParallax();
});
