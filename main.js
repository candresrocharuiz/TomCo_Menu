document.addEventListener('DOMContentLoaded', () => {
    // Navbar scroll effect
    const navbar = document.getElementById('navbar');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Mobile menu toggle
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        
        // Hamburger animation
        const hamburger = document.querySelector('.hamburger');
        if (navLinks.classList.contains('active')) {
            hamburger.style.background = 'transparent';
            hamburger.style.setProperty('--pseudo-top', '0');
            hamburger.style.setProperty('--pseudo-transform', 'rotate(45deg)');
        } else {
            hamburger.style.background = '';
        }
    });

    // Close menu when clicking a link
    const links = document.querySelectorAll('.nav-links a');
    links.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
        });
    });
});
