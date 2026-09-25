javascript
/* =========================================================
   GUNUPUR MATTERS
   ABOUT PAGE JAVASCRIPT
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* =====================================================
       ELEMENTS
    ====================================================== */

    const header =
        document.querySelector(".site-header");

    const menuToggle =
        document.getElementById("menuToggle");

    const mainNav =
        document.getElementById("mainNav");

    const currentYear =
        document.getElementById("currentYear");


    /* =====================================================
       CURRENT YEAR
    ====================================================== */

    if (currentYear) {

        currentYear.textContent =
            new Date().getFullYear();

    }


    /* =====================================================
       MOBILE NAVIGATION
    ====================================================== */

    if (menuToggle && mainNav) {

        menuToggle.addEventListener("click", () => {

            const open =
                mainNav.classList.toggle("open");

            menuToggle.classList.toggle(
                "active",
                open
            );

            menuToggle.setAttribute(
                "aria-expanded",
                String(open)
            );

        });


        mainNav
            .querySelectorAll("a")
            .forEach((link) => {

                link.addEventListener("click", () => {

                    mainNav.classList.remove(
                        "open"
                    );

                    menuToggle.classList.remove(
                        "active"
                    );

                    menuToggle.setAttribute(
                        "aria-expanded",
                        "false"
                    );

                });

            });

    }


    /* =====================================================
       HEADER SHADOW ON SCROLL
    ====================================================== */

    function updateHeader() {

        if (!header) {
            return;
        }

        if (window.scrollY > 30) {

            header.classList.add(
                "scrolled"
            );

        } else {

            header.classList.remove(
                "scrolled"
            );

        }

    }

    window.addEventListener(
        "scroll",
        updateHeader,
        {
            passive: true
        }
    );

    updateHeader();


    /* =====================================================
       SCROLL REVEAL
    ====================================================== */

    const revealElements =
        document.querySelectorAll(
            ".statement-text, " +
            ".story-content, " +
            ".story-visual, " +
            ".work-item, " +
            ".principle-card, " +
            ".perspective-copy, " +
            ".perspective-image, " +
            ".audience-item, " +
            ".final-box"
        );


    revealElements.forEach((element) => {

        element.classList.add("reveal");

    });


    if (
        "IntersectionObserver" in window
    ) {

        const revealObserver =
            new IntersectionObserver(
                (entries, observer) => {

                    entries.forEach((entry) => {

                        if (
                            entry.isIntersecting
                        ) {

                            entry.target.classList.add(
                                "visible"
                            );

                            observer.unobserve(
                                entry.target
                            );

                        }

                    });

                },
                {
                    threshold: 0.12,

                    rootMargin:
                        "0px 0px -35px 0px"
                }
            );


        revealElements.forEach((element) => {

            revealObserver.observe(
                element
            );

        });

    } else {

        revealElements.forEach((element) => {

            element.classList.add(
                "visible"
            );

        });

    }


    /* =====================================================
       SMOOTH INTERNAL LINKS
    ====================================================== */

    document
        .querySelectorAll(
            'a[href^="#"]'
        )
        .forEach((link) => {

            link.addEventListener(
                "click",
                (event) => {

                    const targetId =
                        link.getAttribute(
                            "href"
                        );

                    if (
                        !targetId ||
                        targetId === "#"
                    ) {
                        return;
                    }

                    const target =
                        document.querySelector(
                            targetId
                        );

                    if (!target) {
                        return;
                    }

                    event.preventDefault();

                    const headerHeight =
                        header
                            ? header.offsetHeight
                            : 0;

                    const targetPosition =
                        target.getBoundingClientRect()
                            .top
                        +
                        window.scrollY
                        -
                        headerHeight
                        -
                        15;

                    window.scrollTo({
                        top:
                            targetPosition,

                        behavior:
                            "smooth"
                    });

                }
            );

        });


    /* =====================================================
       ESCAPE KEY
       CLOSE MOBILE MENU
    ====================================================== */

    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Escape" &&
                mainNav &&
                mainNav.classList.contains(
                    "open"
                )
            ) {

                mainNav.classList.remove(
                    "open"
                );

                if (menuToggle) {

                    menuToggle.classList.remove(
                        "active"
                    );

                    menuToggle.setAttribute(
                        "aria-expanded",
                        "false"
                    );

                }

            }

        }
    );


    /* =====================================================
       CLOSE MOBILE MENU WHEN CLICKING OUTSIDE
    ====================================================== */

    document.addEventListener(
        "click",
        (event) => {

            if (
                !mainNav ||
                !menuToggle
            ) {
                return;
            }

            if (
                !mainNav.classList.contains(
                    "open"
                )
            ) {
                return;
            }

            const clickedInsideNav =
                mainNav.contains(
                    event.target
                );

            const clickedToggle =
                menuToggle.contains(
                    event.target
                );

            if (
                !clickedInsideNav &&
                !clickedToggle
            ) {

                mainNav.classList.remove(
                    "open"
                );

                menuToggle.classList.remove(
                    "active"
                );

                menuToggle.setAttribute(
                    "aria-expanded",
                    "false"
                );

            }

        }
    );


    /* =====================================================
       STAGGER WORK ITEMS
    ====================================================== */

    const workItems =
        document.querySelectorAll(
            ".work-item"
        );


    workItems.forEach(
        (item, index) => {

            item.style.transitionDelay =
                `${index * 80}ms`;

        }
    );


    /* =====================================================
       STAGGER PRINCIPLE CARDS
    ====================================================== */

    const principleCards =
        document.querySelectorAll(
            ".principle-card"
        );


    principleCards.forEach(
        (card, index) => {

            card.style.transitionDelay =
                `${index * 70}ms`;

        }
    );


    /* =====================================================
       PARALLAX-LIKE HERO MOVEMENT
       Only when motion is allowed.
    ====================================================== */

    const heroImage =
        document.querySelector(
            ".about-intro-bg"
        );


    const reduceMotion =
        window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;


    if (
        heroImage &&
        !reduceMotion
    ) {

        window.addEventListener(
            "scroll",
            () => {

                const scroll =
                    window.scrollY;

                if (scroll < 700) {

                    heroImage.style.transform =
                        `scale(1.02) translateY(${scroll * 0.08}px)`;

                }

            },
            {
                passive: true
            }
        );

    }

});

