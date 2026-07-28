(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) document.body.classList.add("reduce-motion");

  const menuToggle = document.getElementById("menuToggle");
  const mobileNav = document.getElementById("mobileNav");
  const header = document.querySelector(".site-header");
  const timecodeEl = document.getElementById("hudTimecode");
  const canvas = document.getElementById("spaceCanvas");

  /* ---------- Mobile nav ---------- */
  const setMenuOpen = (open) => {
    if (!menuToggle || !mobileNav) return;
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
    mobileNav.hidden = !open;
  };

  if (menuToggle && mobileNav) {
    menuToggle.addEventListener("click", () => {
      setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true");
    });
    mobileNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setMenuOpen(false));
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth >= 1024) setMenuOpen(false);
    });
  }

  /* ---------- Smooth anchors ---------- */
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      const id = anchor.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      history.pushState(null, "", id);
    });
  });

  /* ---------- Cinematic intro ---------- */
  requestAnimationFrame(() => {
    document.body.classList.remove("is-loading");
    document.body.classList.add("is-ready");
  });

  /* ---------- HUD timecode ---------- */
  const pad = (n, len = 2) => String(n).padStart(len, "0");
  const tickTimecode = () => {
    if (!timecodeEl) return;
    const d = new Date();
    const frames = Math.floor((d.getMilliseconds() / 1000) * 24);
    timecodeEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}:${pad(frames)}`;
  };
  tickTimecode();
  setInterval(tickTimecode, 42);

  /* ---------- Pointer parallax / depth ---------- */
  let targetMX = 0;
  let targetMY = 0;
  let curMX = 0;
  let curMY = 0;

  const setPointer = (clientX, clientY) => {
    targetMX = (clientX / window.innerWidth) * 2 - 1;
    targetMY = (clientY / window.innerHeight) * 2 - 1;
  };

  window.addEventListener(
    "pointermove",
    (e) => {
      if (reduceMotion) return;
      setPointer(e.clientX, e.clientY);
    },
    { passive: true }
  );

  /* ---------- 3D tilt cards ---------- */
  const tiltCards = document.querySelectorAll(".tilt-card");

  const resetTilt = (el) => {
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  tiltCards.forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      if (reduceMotion || window.innerWidth < 768) return;
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const ry = (x - 0.5) * 16;
      const rx = (0.5 - y) * 12;
      card.style.setProperty("--rx", `${rx}deg`);
      card.style.setProperty("--ry", `${ry}deg`);
    });
    card.addEventListener("pointerleave", () => resetTilt(card));
  });

  /* ---------- Scroll reveal + depth ---------- */
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
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" }
    );
    reveals.forEach((el) => observer.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-visible"));
  }

  /* ---------- Starfield / particle space ---------- */
  const initCanvas = () => {
    if (!canvas || reduceMotion) {
      if (canvas) canvas.style.display = "none";
      return null;
    }

    const ctx = canvas.getContext("2d");
    let w = 0;
    let h = 0;
    let particles = [];
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(90, Math.floor((w * h) / 18000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w - w / 2,
        y: Math.random() * h - h / 2,
        z: Math.random() * w,
        s: 0.4 + Math.random() * 1.4,
        hue: Math.random() > 0.5 ? 190 : 260,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2 + curMX * 40;
      const cy = h / 2 + curMY * 28;

      for (const p of particles) {
        p.z -= 2.2 + Math.abs(curMX) * 1.5;
        if (p.z <= 1) {
          p.z = w;
          p.x = Math.random() * w - w / 2;
          p.y = Math.random() * h - h / 2;
        }

        const k = 128 / p.z;
        const x = p.x * k + cx;
        const y = p.y * k + cy;
        const size = (1 - p.z / w) * 2.6 * p.s;
        const alpha = Math.max(0, 1 - p.z / w);

        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, ${alpha * 0.75})`;
        ctx.arc(x, y, Math.max(0.4, size), 0, Math.PI * 2);
        ctx.fill();

        // motion streak
        ctx.beginPath();
        ctx.strokeStyle = `hsla(${p.hue}, 90%, 70%, ${alpha * 0.25})`;
        ctx.lineWidth = size * 0.4;
        ctx.moveTo(x, y);
        ctx.lineTo(x - curMX * 12 * k, y - curMY * 8 * k);
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  };

  initCanvas();

  /* ---------- RAF: lerp parallax + header ---------- */
  const tick = () => {
    curMX += (targetMX - curMX) * 0.06;
    curMY += (targetMY - curMY) * 0.06;
    document.documentElement.style.setProperty("--mx", curMX.toFixed(4));
    document.documentElement.style.setProperty("--my", curMY.toFixed(4));
    document.documentElement.style.setProperty("--scroll-y", String(window.scrollY || 0));

    if (header) {
      header.style.boxShadow =
        window.scrollY > 8 ? "0 8px 30px rgba(0, 0, 0, 0.35)" : "none";
    }

    requestAnimationFrame(tick);
  };

  if (!reduceMotion) {
    requestAnimationFrame(tick);
  } else if (header) {
    window.addEventListener(
      "scroll",
      () => {
        header.style.boxShadow =
          window.scrollY > 8 ? "0 8px 30px rgba(0, 0, 0, 0.35)" : "none";
      },
      { passive: true }
    );
  }
})();
