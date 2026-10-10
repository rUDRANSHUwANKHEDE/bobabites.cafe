document.addEventListener("DOMContentLoaded", () => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];


  /* =====================================================================
     HERO VIDEO – MOUSE / TOUCH SCRUBBING
     targetTime = (mouseX / window.innerWidth) * video.duration
     ===================================================================== */
  (function initScrubVideo() {
    const video = $("#heroVideo");
    const hero = $("#home");
    const stage = $("#heroStage") || video;
    if (!video || !hero) return;

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    const SMOOTHING = 0.18;        // 0–1: higher = snappier, lower = floatier
    const MIN_STEP = 1 / 48;       // half a frame at 24fps
    const SEEK_WATCHDOG_MS = 600;  // give up on a seek that never reports "seeked"
    const MAX_FAILED_SEEKS = 3;    // stop retrying if the file isn't seekable

    video.muted = true;
    video.defaultMuted = true;
    video.pause();                 // never autoplay

    let duration = 0, target = 0, eased = 0;
    let seeking = false, seekStartedAt = 0, requestedTime = 0, failedSeeks = 0;
    let rafId = 0, lastTick = 0, lastX = null, enabled = true;

    const syncDuration = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        duration = video.duration;
        target = clamp(target, 0, duration);
        eased = clamp(eased, 0, duration);
      }
    };
    const schedule = () => { if (!rafId) rafId = requestAnimationFrame(tick); };

    function tick(now) {
      rafId = 0;
      if (!duration) return;

      // frame-rate independent easing toward the target
      const dt = lastTick ? Math.min((now - lastTick) / 16.667, 4) : 1;
      lastTick = now;
      eased += (target - eased) * (1 - Math.pow(1 - SMOOTHING, dt));
      if (Math.abs(target - eased) < 0.0005) eased = target;

      if (seeking && now - seekStartedAt > SEEK_WATCHDOG_MS) seeking = false;

      // only ONE seek in flight; the next is queued from the "seeked" event
      const needsSeek = failedSeeks < MAX_FAILED_SEEKS && Math.abs(video.currentTime - eased) >= MIN_STEP;
      if (needsSeek && !seeking) {
        seeking = true;
        seekStartedAt = now;
        requestedTime = clamp(eased, 0, duration);
        video.currentTime = requestedTime;
      }

      if (eased !== target || seeking || needsSeek) schedule();
      else lastTick = 0; // idle – loop sleeps until the next input
    }

    function setTargetFromX(clientX) {
      lastX = clientX;
      if (!enabled || !duration) return;
      const next = clamp((clientX / (window.innerWidth || 1)) * duration, 0, duration);
      if (next !== target) failedSeeks = 0;
      target = next;
      schedule();
    }

    video.addEventListener("loadedmetadata", syncDuration);
    video.addEventListener("durationchange", syncDuration);
    video.addEventListener("seeked", () => {
      seeking = false;
      failedSeeks = Math.abs(video.currentTime - requestedTime) > 0.1 ? failedSeeks + 1 : 0;
      schedule();
    });
    video.addEventListener("play", () => video.pause());

    window.addEventListener("mousemove", (e) => setTargetFromX(e.clientX), { passive: true });
    const onTouch = (e) => { if (e.touches[0]) setTargetFromX(e.touches[0].clientX); };
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    const onResize = () => { if (lastX !== null) setTargetFromX(lastX); };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    if (video.readyState >= 1) syncDuration();

    // Only scrub (and only show the video) while the hero is on screen.
    new IntersectionObserver(([entry]) => {
      enabled = entry.isIntersecting;
      stage.classList.toggle("is-hidden", !enabled);
      if (enabled) onResize();
    }).observe(hero);
  })();

  /* ---------- Hero typewriter ---------- */
  (function initTypewriter() {
    const el = $("#typeText");
    if (!el) return;
    const phrases = [
      "Fresh drinks. Tasty bites. A cozy place to be.",
      "Good Food • Good Mood",
      "Move or swipe sideways to play the video."
    ];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // keep static text

    let i = 0, text = "", deleting = false;
    el.textContent = "";
    (function step() {
      const full = phrases[i];
      let delay = 45;
      if (!deleting && text === full) { deleting = true; delay = 2200; }
      else if (deleting && text === "") { deleting = false; i = (i + 1) % phrases.length; delay = 350; }
      else if (deleting) { text = full.slice(0, text.length - 1); delay = 24; }
      else { text = full.slice(0, text.length + 1); }
      el.textContent = text;
      setTimeout(step, delay);
    })();
  })();

  /* ---------- Footer year ---------- */
  $("#year").textContent = new Date().getFullYear();

  /* ---------- Sticky navbar shadow ---------- */
  const navbar = $("#navbar");
  const onScroll = () => navbar.classList.toggle("scrolled", window.scrollY > 10);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  const hamburger = $("#hamburger");
  const navLinks = $("#navLinks");
  const closeMenu = () => {
    navLinks.classList.remove("open");
    hamburger.classList.remove("open");
    hamburger.setAttribute("aria-expanded", "false");
  };
  hamburger.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    hamburger.classList.toggle("open", open);
    hamburger.setAttribute("aria-expanded", String(open));
  });
  $$("#navLinks a").forEach(a => a.addEventListener("click", closeMenu));

  /* ---------- Active nav link on scroll ---------- */
  const sections = ["home", "menu", "gallery", "contact"]
    .map(id => document.getElementById(id)).filter(Boolean);
  const links = $$("#navLinks a[href^='#']");
  const spy = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        links.forEach(l => l.classList.toggle("active", l.getAttribute("href") === "#" + e.target.id));
      }
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach(s => spy.observe(s));

  /* ---------- Scroll reveal ---------- */
  const revealObs = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  $$(".reveal").forEach((el, i) => {
    el.style.transitionDelay = `${(i % 5) * 80}ms`;
    revealObs.observe(el);
  });

  /* ---------- Toast ---------- */
  const toast = $("#toast");
  let toastTimer;
  const showToast = msg => {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
  };

  /* ---------- Reservation modal ---------- */
  const modal = $("#reserveModal");
  const form = $("#reserveForm");
  const msg = $("#formMsg");
  const dateInput = $("#dateInput");

  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  dateInput.min = today.toISOString().split("T")[0];
  dateInput.value = dateInput.min;

  const openModal = () => {
    closeMenu();
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => form.elements.name.focus(), 50);
  };
  const closeModal = () => {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  $$("[data-open-reserve]").forEach(b => b.addEventListener("click", openModal));
  $("#closeModal").addEventListener("click", closeModal);
  modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

  form.addEventListener("submit", e => {
    e.preventDefault();
    msg.textContent = "";
    const name = form.elements.name.value.trim();
    const phone = form.elements.phone.value.trim();
    const date = form.elements.date.value;
    const time = form.elements.time.value;

    if (name.length < 2) { msg.textContent = "Please enter your name."; return; }
    if (!/^[+\d][\d\s-]{8,14}$/.test(phone)) { msg.textContent = "Please enter a valid phone number."; return; }
    if (!date || !time) { msg.textContent = "Please choose a date and time."; return; }

    // Café is closed on Sundays
    if (new Date(date + "T00:00").getDay() === 0) {
      msg.textContent = "Sorry, we're closed on Sundays. Please pick another day.";
      return;
    }

    // TODO: send to your backend here (fetch / POST)
    closeModal();
    form.reset();
    dateInput.value = dateInput.min;
    form.elements.time.value = "17:00";
    showToast(`Thanks ${name}! Table booked for ${date} at ${time} 🧋`);
  });

  /* ---------- Misc buttons ---------- */
  $("#tourBtn").addEventListener("click", () => showToast("Virtual tour coming soon! 🏠"));
  $("#exploreMenu").addEventListener("click", e => {
    e.preventDefault();
    showToast("Full menu coming soon! 🧋");
  });

  /* =====================================================================
     MENU: a card glides to the centre (2s) + cup mascot greeting on hover
     ===================================================================== */
  (function initMenuMagic() {
    const section = $("#menu");
    const cards = $$(".drink-card");
    const cup = $(".rec-mascot");
    if (!section || !cards.length) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const EASE = "cubic-bezier(.22, 1, .36, 1)";   // smooth ease-out
    const FLY_MS = reduce ? 1 : 1000;              // card -> centre
    const HOLD_MS = 1000;                          // stays in front for 1 second
    const BACK_MS = reduce ? 1 : 700;              // card -> back to its place
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    let active = null;
    let bubbleOpen = false;       // pauses the loop while the cup bubble is open
    let inView = false;           // loop only runs while the cards are on screen
    let loopId = 0;

    /* ----- spotlight: fly a card to the middle of the screen -----
       auto = true  -> part of the endless loop (light dim, doesn't block the page)
       auto = false -> user clicked a card (dim, close button, click to dismiss) */
    function spotlight(card, auto = false) {
      if (active || $("#reserveModal").classList.contains("open")) return null;
      const r = card.getBoundingClientRect();

      const overlay = document.createElement("div");
      overlay.className = "spot-overlay" + (auto ? " auto" : "");

      const clone = card.cloneNode(true);
      clone.classList.remove("reveal", "visible");
      clone.classList.add("spot-card");
      if (auto) clone.classList.add("auto");
      clone.style.cssText = `top:${r.top}px;left:${r.left}px;width:${r.width}px;height:${r.height}px;`;

      const extras = [];
      if (!auto) {
        const x = document.createElement("button");
        x.className = "spot-close"; x.type = "button"; x.setAttribute("aria-label", "Close"); x.textContent = "×";
        clone.appendChild(x);
        x.addEventListener("click", closeSpotlight);
        overlay.addEventListener("click", closeSpotlight);
        const hint = document.createElement("div");
        hint.className = "spot-hint";
        hint.textContent = "Ask for it at the counter 🧋  ·  click anywhere to close";
        extras.push(hint);
      }

      document.body.append(overlay, clone, ...extras);
      card.style.visibility = "hidden";

      const scale = Math.min(1.45, (innerHeight * 0.8) / r.height, (innerWidth * 0.92) / r.width);
      const dx = innerWidth / 2 - (r.left + r.width / 2);
      const dy = innerHeight / 2 - (r.top + r.height / 2);
      const end = `translate(${dx}px, ${dy}px) scale(${scale})`;

      overlay.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FLY_MS, easing: "ease-out", fill: "forwards" });
      clone.animate(
        [{ transform: "translate(0, 0) scale(1)" }, { transform: end }],
        { duration: FLY_MS, easing: EASE, fill: "forwards" }
      );

      active = { card, clone, overlay, extras, r, auto, startY: scrollY };
      return active;
    }

    function closeSpotlight() {
      if (!active) return Promise.resolve();
      const { card, clone, overlay, extras, r } = active;
      active = null;
      extras.forEach(e => e.remove());
      const now = getComputedStyle(clone).transform;
      const o = getComputedStyle(overlay).opacity;
      const n = card.getBoundingClientRect();           // card may have moved if page scrolled
      const home = `translate(${n.left - r.left}px, ${n.top - r.top}px) scale(1)`;
      overlay.animate([{ opacity: o }, { opacity: 0 }], { duration: BACK_MS, fill: "forwards" });
      return new Promise(res => {
        clone.animate([{ transform: now }, { transform: home }],
          { duration: BACK_MS, easing: EASE, fill: "forwards" }
        ).onfinish = () => { card.style.visibility = ""; clone.remove(); overlay.remove(); res(); };
      });
    }
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeSpotlight(); });
    window.addEventListener("scroll", () => {
      if (active && !active.auto && Math.abs(scrollY - active.startY) > 160) closeSpotlight();
    }, { passive: true });

    // clicking a card brings it to the middle (interrupts the loop; it resumes after closing)
    async function manualSpotlight(card) {
      hideBubble(true);
      if (active && active.auto) await closeSpotlight();
      spotlight(card, false);
    }
    cards.forEach(c => c.addEventListener("click", () => manualSpotlight(c)));

    /* ----- endless loop: every card, one by one, 2 seconds in front ----- */
    async function runLoop() {
      const id = ++loopId;
      let i = 0;
      await sleep(900);                                  // let the reveal animation finish
      while (id === loopId && inView) {
        const blocked = bubbleOpen || (active && !active.auto) || $("#reserveModal").classList.contains("open");
        if (blocked) { await sleep(400); continue; }
        const card = cards[i++ % cards.length];
        if (!spotlight(card, true)) { await sleep(400); continue; }
        const mine = active;
        await sleep(FLY_MS + HOLD_MS);
        if (active === mine) await closeSpotlight();     // (already closed if the user interrupted)
        else await sleep(BACK_MS);
        await sleep(350);
      }
    }
    new IntersectionObserver(([en]) => {
      inView = en.isIntersecting;
      if (inView) runLoop();
      else { loopId++; if (active && active.auto) closeSpotlight(); }
    }, { threshold: 0.6 }).observe($(".cards-5"));

    /* ----- cup mascot: big greeting + recommendations on hover ----- */
    if (!cup) return;
    cup.setAttribute("tabindex", "0");
    cup.setAttribute("role", "button");
    cup.setAttribute("aria-label", "Show recommendations");

    const bubble = document.createElement("div");
    bubble.className = "cup-bubble";
    bubble.setAttribute("role", "status");
    bubble.innerHTML = `<p class="cup-say">How's it going? Let's try <em>'Recommendation'</em> 🧋</p><div class="cup-picks"></div>`;
    section.appendChild(bubble);
    const picksBox = $(".cup-picks", bubble);

    const shuffle = a => a.map(v => [Math.random(), v]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
    function fillPicks() {
      picksBox.innerHTML = "";
      shuffle(cards).slice(0, 3).forEach(card => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "cup-pick";
        b.innerHTML = `<img src="${$("img", card).src}" alt="" /><span><b>${$("h3", card).textContent}</b><small>${$("p", card).textContent}</small></span>`;
        b.addEventListener("click", () => manualSpotlight(card));
        picksBox.appendChild(b);
      });
    }

    let hideTimer;
    function showBubble() {
      clearTimeout(hideTimer);
      bubbleOpen = true;
      if (active && active.auto) closeSpotlight();
      if (!bubble.classList.contains("show")) { fillPicks(); void bubble.offsetWidth; }
      bubble.classList.add("show");
    }
    function hideBubble(now) {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => { bubble.classList.remove("show"); bubbleOpen = false; }, now ? 0 : 350);
    }
    [cup, bubble].forEach(el => {
      el.addEventListener("mouseenter", showBubble);
      el.addEventListener("mouseleave", () => hideBubble());
    });
    cup.addEventListener("focus", showBubble);
    cup.addEventListener("blur", () => hideBubble());
    cup.addEventListener("click", () => bubble.classList.contains("show") ? hideBubble(true) : showBubble());
  })();
});
