(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) document.body.classList.add("reduce-motion");

  // Discourage copying UI text / buttons
  const blockCopy = (event) => {
    event.preventDefault();
  };
  document.addEventListener("copy", blockCopy);
  document.addEventListener("cut", blockCopy);
  document.addEventListener("selectstart", blockCopy);
  document.addEventListener("dragstart", blockCopy);
  document.addEventListener("contextmenu", (event) => {
    const tag = (event.target && event.target.tagName) || "";
    if (/^(A|BUTTON|SPAN|DIV|P|H1|H2|H3|H4|LI|NAV|HEADER|MAIN|SECTION)$/i.test(tag) ||
        (event.target && event.target.closest && event.target.closest("a, button, .btn"))) {
      event.preventDefault();
    }
  });

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

  /* Shared pointer state for parallax + particles */
  const pointer = {
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    vx: 0,
    vy: 0,
    speed: 0,
    active: false,
  };

  const updatePointer = (clientX, clientY, active = true) => {
    pointer.px = pointer.x;
    pointer.py = pointer.y;
    pointer.x = clientX;
    pointer.y = clientY;
    pointer.vx = pointer.x - pointer.px;
    pointer.vy = pointer.y - pointer.py;
    pointer.speed = Math.hypot(pointer.vx, pointer.vy);
    pointer.active = active;
    targetMX = (clientX / window.innerWidth) * 2 - 1;
    targetMY = (clientY / window.innerHeight) * 2 - 1;
  };

  window.addEventListener(
    "pointermove",
    (e) => {
      if (reduceMotion) return;
      updatePointer(e.clientX, e.clientY, true);
    },
    { passive: true }
  );

  window.addEventListener(
    "pointerdown",
    (e) => {
      if (reduceMotion) return;
      updatePointer(e.clientX, e.clientY, true);
    },
    { passive: true }
  );

  window.addEventListener(
    "pointerleave",
    () => {
      pointer.active = false;
      pointer.speed = 0;
    },
    { passive: true }
  );

  window.addEventListener(
    "blur",
    () => {
      pointer.active = false;
      pointer.speed = 0;
    },
    { passive: true }
  );

  /* Interactive particle field */
  const initParticleField = () => {
    if (!canvas || reduceMotion) {
      if (canvas) canvas.style.display = "none";
      return;
    }

    const ctx = canvas.getContext("2d", { alpha: true });
    let w = 0;
    let h = 0;
    let particles = [];
    let linkRadius = 110;
    let affectRadius = 140;

    const makeParticle = () => {
      const x = Math.random() * w;
      const y = Math.random() * h;
      return {
        x,
        y,
        homeX: x,
        homeY: y,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: 1.1 + Math.random() * 1.8,
        hue: Math.random() > 0.55 ? 265 : 188,
        phase: Math.random() * Math.PI * 2,
      };
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const area = w * h;
      const count = Math.max(48, Math.min(120, Math.floor(area / 14000)));
      linkRadius = Math.min(130, 70 + w * 0.03);
      affectRadius = Math.min(180, 100 + w * 0.04);
      particles = Array.from({ length: count }, makeParticle);

      if (!pointer.active) {
        pointer.x = w * 0.5;
        pointer.y = h * 0.45;
        pointer.px = pointer.x;
        pointer.py = pointer.y;
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      const affectR2 = affectRadius * affectRadius;
      const linkR2 = linkRadius * linkRadius;
      const burst = Math.min(1, pointer.speed / 18);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Soft idle drift
        p.phase += 0.008;
        p.vx += Math.cos(p.phase) * 0.004;
        p.vy += Math.sin(p.phase * 0.9) * 0.004;

        // Pull gently toward home so field stays stable
        p.vx += (p.homeX - p.x) * 0.0022;
        p.vy += (p.homeY - p.y) * 0.0022;

        if (pointer.active) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const dist2 = dx * dx + dy * dy;

          if (dist2 < affectR2 && dist2 > 0.01) {
            const dist = Math.sqrt(dist2);
            const nx = dx / dist;
            const ny = dy / dist;
            const falloff = 1 - dist / affectRadius;

            // Fast cursor → repel / scatter
            // Slow cursor → mild attract
            const repel = (0.35 + burst * 1.8) * falloff * falloff;
            const attract = (0.22 - burst * 0.2) * falloff;

            p.vx += nx * (repel - attract) * 1.15;
            p.vy += ny * (repel - attract) * 1.15;

            // Transfer a bit of cursor velocity for "kick"
            p.vx += pointer.vx * 0.035 * falloff;
            p.vy += pointer.vy * 0.035 * falloff;
          }
        }

        // Damping + integrate
        p.vx *= 0.92;
        p.vy *= 0.92;
        p.x += p.vx;
        p.y += p.vy;

        // Soft wrap
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;
      }

      // Connections near pointer only (cheap + readable)
      if (pointer.active) {
        ctx.lineWidth = 1;
        for (let i = 0; i < particles.length; i++) {
          const a = particles[i];
          const adx = a.x - pointer.x;
          const ady = a.y - pointer.y;
          if (adx * adx + ady * ady > linkR2 * 2.2) continue;

          for (let j = i + 1; j < particles.length; j++) {
            const b = particles[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > linkR2 || d2 === 0) continue;

            const t = 1 - Math.sqrt(d2) / linkRadius;
            ctx.strokeStyle = `rgba(180, 163, 255, ${t * 0.28})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const spd = Math.hypot(p.vx, p.vy);
        const glow = Math.min(1, spd * 0.55);

        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue}, 85%, ${72 + glow * 12}%, ${0.55 + glow * 0.35})`;
        ctx.arc(p.x, p.y, p.r + glow * 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Short motion streak when kicked
        if (spd > 1.2) {
          ctx.beginPath();
          ctx.strokeStyle = `hsla(${p.hue}, 85%, 78%, ${Math.min(0.45, spd * 0.12)})`;
          ctx.lineWidth = 1;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2);
          ctx.stroke();
        }
      }

      // Soft cursor aura
      if (pointer.active) {
        const aura = ctx.createRadialGradient(
          pointer.x,
          pointer.y,
          0,
          pointer.x,
          pointer.y,
          affectRadius
        );
        aura.addColorStop(0, `rgba(139, 116, 255, ${0.12 + burst * 0.1})`);
        aura.addColorStop(0.45, "rgba(94, 231, 247, 0.04)");
        aura.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, affectRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize, { passive: true });
  };

  initParticleField();

  /* Cinematic whale: continuous forward swim on a soft orbital path (never pivots in place) */
  const initWhale = () => {
    const whale = document.getElementById("whale");
    const body = document.getElementById("whaleBody");
    const head = document.getElementById("whaleHead");
    const fin = document.getElementById("whaleFin");
    const peduncle = document.getElementById("whalePeduncle");
    const fluke = document.getElementById("whaleFluke");
    const wake = whale ? whale.querySelector(".whale-wake") : null;
    const bubbles = document.getElementById("whaleBubbles");

    if (!whale || !body || !fluke || reduceMotion) {
      if (whale) whale.style.display = "none";
      return;
    }

    whale.classList.remove("is-flipped");

    const P = {
      body: [300, 130],
      head: [200, 128],
      fin: [208, 150],
      peduncle: [448, 132],
      fluke: [520, 134],
    };

    const setRot = (el, deg, [cx, cy]) => {
      el.setAttribute("transform", `rotate(${deg.toFixed(2)} ${cx} ${cy})`);
    };

    const TAU = Math.PI * 2;
    const ART_NOSE = Math.PI; // SVG nose points left
    const wrapAngle = (a) => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    let w = 0;
    let h = 0;
    let whaleW = 0;
    let whaleH = 0;

    // Orbit phase — whale is always mid-swim on this path
    let orbit = Math.random() * TAU;
    let heading = 0;
    let cx = 0;
    let cy = 0;
    let phase = Math.random() * TAU;
    let t = 0;
    let last = performance.now();
    let ready = false;

    const measure = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      whaleW = whale.offsetWidth || Math.min(w * 0.28, 300);
      whaleH = whaleW * (240 / 640);
    };

    const orbitPad = () => {
      // Conservative pad for any heading (full diagonal)
      const pad = Math.hypot(whaleW, whaleH) * 0.52 + 20;
      return {
        midX: w * 0.5,
        midY: h * 0.48,
        ax: Math.max(40, w * 0.5 - pad),
        ay: Math.max(30, h * 0.5 - pad - 36),
      };
    };

    // Soft cinematic circuit: elongated ellipse with gentle breathing (no cusps)
    const samplePath = (theta, time) => {
      const { midX, midY, ax, ay } = orbitPad();
      const breathe = 1 + 0.035 * Math.sin(time * 0.22);
      const drift = 0.03 * Math.sin(time * 0.11);
      const x = midX + ax * breathe * Math.cos(theta);
      const y = midY + ay * breathe * Math.sin(theta + drift);
      return { x, y };
    };

    const samplePose = (theta, time) => {
      const p0 = samplePath(theta, time);
      // Forward difference → always face travel direction
      const p1 = samplePath(theta + 0.02, time);
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const ang = Math.atan2(dy, dx);
      return { x: p0.x, y: p0.y, ang };
    };

    const applyPose = (pose, swimPhase, turnLean) => {
      cx = pose.x;
      cy = pose.y;
      heading = pose.ang;

      const amp = 0.55;
      const s = Math.sin(swimPhase);
      const s2 = Math.sin(swimPhase - 0.6);
      const s3 = Math.sin(swimPhase - 1.15);

      // Side-view whale: fluke beat = vertical undulation in silhouette plane
      setRot(body, s2 * 3.2 * amp + turnLean * 0.35, P.body);
      setRot(head, -s * 2.8 * amp, P.head);
      setRot(fin, Math.sin(swimPhase * 0.85 + 0.9) * 10 * amp, P.fin);
      setRot(peduncle, s3 * 9 * amp, P.peduncle);
      setRot(fluke, Math.sin(swimPhase - 1.5) * 16 * amp, P.fluke);

      if (wake) {
        const kick = 0.5 + s * 0.5;
        wake.style.opacity = String(0.14 + kick * 0.22);
        wake.style.transform = `translateY(-50%) scaleX(${0.55 + kick * 0.4})`;
      }

      if (bubbles) {
        const burst = Math.max(0, s);
        bubbles.style.opacity = String(0.05 + burst * 0.28);
        bubbles.style.transform = `translate(${-burst * 5}px, ${-burst * 7}px)`;
      }

      const visualDeg = ((heading + ART_NOSE) * 180) / Math.PI;
      whale.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0) translate(-50%, -50%) rotate(${visualDeg.toFixed(2)}deg)`;
    };

    const swim = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      t += dt;

      // Slow cruise around the circuit (~one lap / ~45–55s)
      const orbitSpeed = 0.12 + 0.025 * Math.sin(t * 0.15);
      const prev = samplePose(orbit, t);
      orbit += orbitSpeed * dt;
      const pose = samplePose(orbit, t);

      // Tiny heading ease so silhouette doesn't micro-jitter — still forward-biased
      const turnErr = wrapAngle(pose.ang - heading);
      const easedAng = heading + turnErr * (1 - Math.pow(0.86, dt * 60));
      const lean = clamp(turnErr * 10, -5, 5);

      // Swim cycle locked to travel (power stroke feel)
      const dist = Math.hypot(pose.x - prev.x, pose.y - prev.y);
      phase += dt * (1.05 + dist * 2.2);

      applyPose({ x: pose.x, y: pose.y, ang: easedAng }, phase, lean);

      if (!ready) {
        ready = true;
        whale.classList.add("is-alive");
      }

      requestAnimationFrame(swim);
    };

    measure();
    // First paint already mid-swim & correctly oriented (no spin-up)
    const boot = samplePose(orbit, 0);
    heading = boot.ang;
    applyPose(boot, phase, 0);

    window.addEventListener(
      "resize",
      () => {
        measure();
        const pose = samplePose(orbit, t);
        heading = pose.ang;
        applyPose(pose, phase, 0);
      },
      { passive: true }
    );

    // Fade in on next frame so layout size is correct
    requestAnimationFrame(() => {
      measure();
      const pose = samplePose(orbit, t);
      heading = pose.ang;
      applyPose(pose, phase, 0);
      whale.classList.add("is-alive");
      last = performance.now();
      requestAnimationFrame(swim);
    });
  };

  initWhale();

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
