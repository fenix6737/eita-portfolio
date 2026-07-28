(() => {
  const menuToggle = document.getElementById("menuToggle");
  const mobileNav = document.getElementById("mobileNav");

  const setMenuOpen = (open) => {
    if (!menuToggle || !mobileNav) return;
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
    mobileNav.hidden = !open;
  };

  if (menuToggle && mobileNav) {
    menuToggle.addEventListener("click", () => {
      const open = menuToggle.getAttribute("aria-expanded") !== "true";
      setMenuOpen(open);
    });

    mobileNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setMenuOpen(false));
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth >= 1024) setMenuOpen(false);
    });
  }

  // Smooth scroll for older browsers / ensure header offset feels right
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      const id = anchor.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.pushState(null, "", id);
    });
  });

  // Fade-in on scroll
  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach((el) => observer.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-visible"));
  }

  // Header shadow on scroll
  const header = document.querySelector(".site-header");
  const onScroll = () => {
    if (!header) return;
    header.style.boxShadow =
      window.scrollY > 8 ? "0 8px 30px rgba(0, 0, 0, 0.35)" : "none";
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();
