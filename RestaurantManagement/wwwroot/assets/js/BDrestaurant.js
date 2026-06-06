const slides = document.querySelector('.slides');
const slide = document.querySelectorAll('.header-slide');

const nextBtn = document.querySelector('.next');
const prevBtn = document.querySelector('.prev');
const dotsContainer = document.querySelector('.dots');

let index = 1;

const firstClone = slide[0].cloneNode(true);
const lastClone = slide[slide.length - 1].cloneNode(true);

slides.appendChild(firstClone);
slides.prepend(lastClone);

const allSlides = document.querySelectorAll('.header-slide');

slides.style.transform = `translateX(-100%)`;

slide.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.addEventListener('click', () => moveToSlide(i + 1));
    dotsContainer.appendChild(dot);
});

const dots = document.querySelectorAll('.dots span');

function updateDots() {
    dots.forEach(dot => dot.classList.remove('active'));
    if (dots[index - 1]) {
        dots[index - 1].classList.add('active');
    }
}

function moveToSlide(i) {
    index = i;
    slides.style.transition = "0.5s";
    slides.style.transform = `translateX(-${index * 100}%)`;
    updateDots();
}

nextBtn.addEventListener('click', () => {
    if (index >= allSlides.length - 1) return;
    index++;
    moveToSlide(index);
});

prevBtn.addEventListener('click', () => {
    if (index <= 0) return;
    index--;
    moveToSlide(index);
});

slides.addEventListener('transitionend', () => {

    if (!allSlides[index]) return;

    if (allSlides[index].isSameNode(firstClone)) {
        slides.style.transition = "none";
        index = 1;
        slides.style.transform = `translateX(-100%)`;
    }

    if (allSlides[index].isSameNode(lastClone)) {
        slides.style.transition = "none";
        index = slide.length;
        slides.style.transform = `translateX(-${index * 100}%)`;
    }

    updateDots();
});

setInterval(() => {
    if (index >= allSlides.length - 1) return;

    index++;
    moveToSlide(index);
}, 5000);

updateDots();

//go top
(function () {
    const btn = document.getElementById('goTop');
    if (!btn) return;

    // Lấy chiều cao header để mốc hiển thị
    function headerOffset() {
        const h = document.querySelector('header') || document.querySelector('#masthead') || document.querySelector('.site-header');
        return h ? h.getBoundingClientRect().height : 120; // fallback 120px
    }
    let threshold = headerOffset();

    // Hiện/ẩn khi cuộn
    function onScroll() {
        if (window.scrollY > threshold) {
            btn.classList.add('show');
        } else {
            btn.classList.remove('show');
        }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => { threshold = headerOffset(); onScroll(); });

    onScroll();
})();

//Log in
if (!localStorage.getItem('authToken')) {
    document.querySelector(".primary-menu ul").insertAdjacentHTML(`beforeend`, `<li><a href="login.html">Login</a></li>`);
} else {
    document.querySelector(".primary-menu ul").insertAdjacentHTML(`beforeend`, `<li><a href="#" id="logout-btn">Logout</a></li>`);

    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('authToken');
        window.location.reload();
    });
}

//Primary menu
const openMenu = document.querySelector("#hamburger");
const closeMenu = document.querySelector("#close-btn");
const primaryMenu = document.querySelector("#primary-menu");
const overlay = document.querySelector("#overlay");

openMenu.addEventListener("click", function () {
    primaryMenu.classList.add("active");
    closeMenu.style.display = "block";
    overlay.style.display = "block";
});

closeMenu.addEventListener("click", function () {
    primaryMenu.classList.remove("active");
    closeMenu.style.display = "none";
    overlay.style.display = "none";
});

// Validate form
// Main form
const Mname = document.querySelector("#name");
const email = document.querySelector("#email");

const nameE = document.querySelector("#name-error");
const emailE = document.querySelector("#email-error");

const messageBtn = document.querySelector("#message-btn");

messageBtn.addEventListener("click", function () {

    if (!Mname.value) {
        nameE.innerText = "*Name must be filled!";
        Mname.parentElement.classList.remove("mb-4")
    } else {
        nameE.innerText = "";
        Mname.parentElement.classList.add("mb-4")
    }

    if (!email.value) {
        emailE.innerText = "*Email must be filled!";
        email.parentElement.classList.remove("mb-4")
    } else {
        emailE.innerText = "";
        email.parentElement.classList.add("mb-4")
    }
});

//Footer email
const FEmail = document.querySelector("#footer-email");

const FEmailE = document.querySelector("#f-email-error");

document.querySelector("#footer-btn").addEventListener("click", function () {
    if (!FEmail.value) {
        FEmailE.innerText = "*Email must be filled!";
    } else {
        FEmailE.innerText = "";
    }
})
