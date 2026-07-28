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

  /* Whale: stays on-screen, seeks waypoints with capped turn rate (no flip snaps) */
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

    let w = window.innerWidth;
    let h = window.innerHeight;
    let whaleW = 0;
    let whaleH = 0;

    // Center of whale
    let cx = w * 0.5;
    let cy = h * 0.45;
    let heading = 0; // 0 = swim right
    let speed = 0.14;
    let phase = Math.random() * TAU;
    let goalX = cx + w * 0.2;
    let goalY = cy;
    let last = performance.now();

    // ~40°/s max — slow deliberate arcs, no flutter
    const MAX_TURN = 0.7;
    const CRUISE = 0.15;
    const ARRIVE = 70;

    const measure = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      whaleW = whale.offsetWidth || Math.min(w * 0.28, 300);
      whaleH = whaleW * (240 / 640);
    };

    // Rotated AABB half-size so the whole silhouette stays inside
    const halfExtents = (angle) => {
      const c = Math.abs(Math.cos(angle));
      const s = Math.abs(Math.sin(angle));
      // Extra pad for glow / wake
      const pad = 18;
      return {
        hx: (whaleW * 0.5) * c + (whaleH * 0.5) * s + pad,
        hy: (whaleW * 0.5) * s + (whaleH * 0.5) * c + pad,
      };
    };

    const safeRect = (angle) => {
      const { hx, hy } = halfExtents(angle);
      const topPad = 64; // header
      return {
        minX: hx,
        maxX: w - hx,
        minY: hy + topPad,
        maxY: h - hy,
      };
    };

    const clampToSafe = (x, y, angle) => {
      const r = safeRect(angle);
      // Degenerate on tiny screens
      if (r.maxX < r.minX || r.maxY < r.minY) {
        return { x: w * 0.5, y: h * 0.5 };
      }
      return {
        x: clamp(x, r.minX, r.maxX),
        y: clamp(y, r.minY, r.maxY),
      };
    };

    const pickGoal = () => {
      const r = safeRect(heading);
      if (r.maxX < r.minX || r.maxY < r.minY) {
        goalX = w * 0.5;
        goalY = h * 0.5;
        return;
      }

      let bestX = goalX;
      let bestY = goalY;
      let bestScore = -Infinity;

      // Prefer distant goals that need a clear arc turn
      for (let i = 0; i < 14; i += 1) {
        const x = r.minX + Math.random() * (r.maxX - r.minX);
        const y = r.minY + Math.random() * (r.maxY - r.minY);
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < Math.min(w, h) * 0.28) continue;

        const absTurn = Math.abs(wrapAngle(Math.atan2(dy, dx) - heading));
        // Reward 50°–150° turns (visible くるり), penalize tiny wiggles & 180° snaps
        const turnScore = absTurn > 0.7 && absTurn < 2.5 ? absTurn : absTurn * 0.25;
        const score = dist * 0.01 + turnScore * 40 + Math.random() * 5;
        if (score > bestScore) {
          bestScore = score;
          bestX = x;
          bestY = y;
        }
      }

      goalX = bestX;
      goalY = bestY;
    };

    const swim = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;

      let dx = goalX - cx;
      let dy = goalY - cy;
      let dist = Math.hypot(dx, dy);

      if (dist < ARRIVE) {
        pickGoal();
        dx = goalX - cx;
        dy = goalY - cy;
        dist = Math.hypot(dx, dy) || 1;
      }

      // Desired heading toward goal
      let desired = Math.atan2(dy, dx);

      // Soft wall bias: if close to edge, blend desired toward inward (not snap)
      const r = safeRect(heading);
      const edge = Math.min(w, h) * 0.16;
      let inwardX = 0;
      let inwardY = 0;
      if (cx < r.minX + edge) inwardX += (r.minX + edge - cx) / edge;
      if (cx > r.maxX - edge) inwardX -= (cx - (r.maxX - edge)) / edge;
      if (cy < r.minY + edge) inwardY += (r.minY + edge - cy) / edge;
      if (cy > r.maxY - edge) inwardY -= (cy - (r.maxY - edge)) / edge;
      const inwardMag = Math.hypot(inwardX, inwardY);
      if (inwardMag > 0.05) {
        const inwardAng = Math.atan2(inwardY, inwardX);
        const blend = clamp(inwardMag, 0, 1) * 0.85;
        // Slerp-ish on angle
        desired = desired + wrapAngle(inwardAng - desired) * blend;
      }

      // Caps turn rate — continuous arc only
      const err = wrapAngle(desired - heading);
      const maxStep = MAX_TURN * dt;
      const step = clamp(err, -maxStep, maxStep);
      heading += step;

      // Slow in tight turns; never reverse in place
      const turnMag = Math.min(1, Math.abs(err) / 1.1);
      const desiredSpeed = CRUISE * (0.45 + 0.55 * (1 - turnMag * 0.7));
      speed += (desiredSpeed - speed) * (1 - Math.pow(0.9, dt * 60));

      cx += Math.cos(heading) * speed * (dt * 60);
      cy += Math.sin(heading) * speed * (dt * 60);

      const clamped = clampToSafe(cx, cy, heading);
      cx = clamped.x;
      cy = clamped.y;

      // If goal ended up outside (resize) or we're stuck hugging a wall, re-pick
      const gr = safeRect(heading);
      if (
        goalX < gr.minX ||
        goalX > gr.maxX ||
        goalY < gr.minY ||
        goalY > gr.maxY ||
        (inwardMag > 0.9 && dist < ARRIVE * 1.5)
      ) {
        pickGoal();
      }

      // Gentle body undulation (no bank flutter)
      phase += dt * (1.15 + speed * 1.4);
      const amp = 0.6 + speed * 0.8;
      const s = Math.sin(phase);
      const s2 = Math.sin(phase - 0.55);
      const s3 = Math.sin(phase - 1.1);
      const lean = clamp(-step / (maxStep || 0.001), -1, 1) * 4;

      setRot(body, s2 * 4.5 * amp + lean, P.body);
      setRot(head, -s * 4 * amp, P.head);
      setRot(fin, Math.sin(phase * 0.9 + 1.2) * 12 * amp, P.fin);
      setRot(peduncle, s3 * 12 * amp, P.peduncle);
      setRot(fluke, Math.sin(phase - 1.45) * 20 * amp, P.fluke);

      if (wake) {
        const wakeScale = 0.6 + (0.5 + s * 0.5) * 0.45;
        wake.style.opacity = String(0.16 + (0.5 + s * 0.5) * 0.28);
        wake.style.transform = `translateY(-50%) scaleX(${wakeScale})`;
      }

      if (bubbles) {
        const burst = Math.max(0, s);
        bubbles.style.opacity = String(0.06 + burst * 0.35);
        bubbles.style.transform = `translate(${-burst * 6}px, ${-burst * 8}px)`;
      }

      const visualDeg = ((heading + ART_NOSE) * 180) / Math.PI;
      whale.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0) translate(-50%, -50%) rotate(${visualDeg.toFixed(2)}deg)`;

      requestAnimationFrame(swim);
    };

    measure();
    const start = clampToSafe(cx, cy, heading);
    cx = start.x;
    cy = start.y;
    pickGoal();

    window.addEventListener(
      "resize",
      () => {
        measure();
        const c = clampToSafe(cx, cy, heading);
        cx = c.x;
        cy = c.y;
        pickGoal();
      },
      { passive: true }
    );
    requestAnimationFrame(swim);
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
