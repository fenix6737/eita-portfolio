(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) document.body.classList.add("reduce-motion");

  const menuToggle = document.getElementById("menuToggle");
  const mobileNav = document.getElementById("mobileNav");
  const header = document.querySelector(".site-header");
  const timecodeEl = document.getElementById("hudTimecode");
  const canvas = document.getElementById("spaceCanvas");

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

  requestAnimationFrame(() => {
    document.body.classList.remove("is-loading");
    document.body.classList.add("is-ready");
  });

  const pad = (n, len = 2) => String(n).padStart(len, "0");
  const tickTimecode = () => {
    if (!timecodeEl) return;
    const d = new Date();
    const frames = Math.floor((d.getMilliseconds() / 1000) * 24);
    timecodeEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}:${pad(frames)}`;
  };
  tickTimecode();
  if (!reduceMotion) setInterval(tickTimecode, 100);

  let targetMX = 0;
  let targetMY = 0;
  let curMX = 0;
  let curMY = 0;

  window.addEventListener(
    "pointermove",
    (e) => {
      if (reduceMotion) return;
      targetMX = (e.clientX / window.innerWidth) * 2 - 1;
      targetMY = (e.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true }
  );

  const initCanvas = () => {
    if (!canvas || reduceMotion) {
      if (canvas) canvas.style.display = "none";
      return;
    }

    const ctx = canvas.getContext("2d");
    let w = 0;
    let h = 0;
    let particles = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(70, Math.floor((w * h) / 22000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w - w / 2,
        y: Math.random() * h - h / 2,
        z: Math.random() * w,
        s: 0.4 + Math.random() * 1.2,
        hue: Math.random() > 0.5 ? 190 : 260,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2 + curMX * 24;
      const cy = h / 2 + curMY * 16;

      for (const p of particles) {
        p.z -= 1.4;
        if (p.z <= 1) {
          p.z = w;
          p.x = Math.random() * w - w / 2;
          p.y = Math.random() * h - h / 2;
        }

        const k = 128 / p.z;
        const x = p.x * k + cx;
        const y = p.y * k + cy;
        const size = (1 - p.z / w) * 2.2 * p.s;
        const alpha = Math.max(0, 1 - p.z / w);

        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue}, 85%, 78%, ${alpha * 0.85})`;
        ctx.arc(x, y, Math.max(0.35, size), 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize, { passive: true });
  };

  initCanvas();

  const tick = () => {
    curMX += (targetMX - curMX) * 0.045;
    curMY += (targetMY - curMY) * 0.045;
    document.documentElement.style.setProperty("--mx", curMX.toFixed(4));
    document.documentElement.style.setProperty("--my", curMY.toFixed(4));

    if (header) {
      header.style.boxShadow =
        window.scrollY > 8 ? "0 8px 28px rgba(0, 0, 0, 0.32)" : "none";
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
          window.scrollY > 8 ? "0 8px 28px rgba(0, 0, 0, 0.32)" : "none";
      },
      { passive: true }
    );
  }
})();
