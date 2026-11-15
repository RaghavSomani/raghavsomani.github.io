(() => {
  const scriptUrl = document.currentScript.src;
  const navigation = document.getElementById("site-nav");
  const navToggle = navigation?.querySelector(".greedy-nav__toggle");
  const visibleLinks = navigation?.querySelector(".visible-links");
  const hiddenLinks = navigation?.querySelector(".hidden-links");
  let measuredNavWidth;
  let navFrame = null;

  function setNavigationOpen(open) {
    hiddenLinks.classList.toggle("hidden", !open);
    hiddenLinks.setAttribute("aria-hidden", String(!open));
    navToggle.classList.toggle("close", open);
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
  }

  function updateNavigation() {
    if (!navigation) return;
    const wasOpen = navToggle.getAttribute("aria-expanded") === "true";
    const focusedElement = document.activeElement;
    measuredNavWidth = navigation.clientWidth;
    visibleLinks.append(...hiddenLinks.children);
    setNavigationOpen(false);
    navToggle.classList.add("hidden");

    if (visibleLinks.offsetWidth > measuredNavWidth) {
      navToggle.classList.remove("hidden");
      const availableSpace = measuredNavWidth - navToggle.offsetWidth - 30;
      while (visibleLinks.offsetWidth > availableSpace && visibleLinks.children.length > 1) {
        hiddenLinks.prepend(visibleLinks.lastElementChild);
      }
    }
    const hiddenCount = hiddenLinks.children.length;
    navToggle.setAttribute("count", hiddenCount);
    navToggle.classList.toggle("hidden", hiddenCount === 0);
    setNavigationOpen(wasOpen && hiddenCount > 0);

    if (navigation.contains(focusedElement)) {
      if (focusedElement.getClientRects().length) focusedElement.focus();
      else if (hiddenCount) navToggle.focus();
    }
  }

  function scheduleNavigation() {
    if (navFrame !== null) return;
    navFrame = requestAnimationFrame(() => {
      navFrame = null;
      updateNavigation();
    });
  }

  navToggle?.addEventListener("click", () => {
    setNavigationOpen(navToggle.getAttribute("aria-expanded") !== "true");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && navToggle?.getAttribute("aria-expanded") === "true") {
      setNavigationOpen(false);
      navToggle.focus();
    }
  });
  if (navigation && window.ResizeObserver) {
    new ResizeObserver(() => {
      if (navigation.clientWidth !== measuredNavWidth) scheduleNavigation();
    }).observe(navigation);
  }
  document.fonts.ready.then(scheduleNavigation);
  updateNavigation();

  const profileToggle = document.querySelector(".author__urls-toggle");
  const profileLinks = document.getElementById("author-profile-links");
  let profileIsDesktop;

  function updateProfiles() {
    if (!profileToggle) return;
    const desktop = getComputedStyle(profileToggle).display === "none";
    if (desktop === profileIsDesktop) return;
    profileIsDesktop = desktop;
    profileToggle.setAttribute("aria-expanded", "false");
    profileToggle.classList.remove("open");
    profileLinks.classList.remove("is-open");
    profileLinks.setAttribute("aria-hidden", String(!desktop));
  }

  profileToggle?.addEventListener("click", () => {
    const open = profileToggle.getAttribute("aria-expanded") !== "true";
    profileToggle.setAttribute("aria-expanded", String(open));
    profileToggle.classList.toggle("open", open);
    profileLinks.classList.toggle("is-open", open);
    profileLinks.setAttribute("aria-hidden", String(!open));
  });
  window.addEventListener("resize", () => {
    if (navigation?.clientWidth !== measuredNavWidth) scheduleNavigation();
    updateProfiles();
  });
  updateProfiles();

  document.querySelector(".author__pronunciation")?.addEventListener("click", async (event) => {
    const audio = document.getElementById(event.currentTarget.getAttribute("aria-controls"));
    const status = document.getElementById("name-audio-status");
    status.textContent = "";
    try {
      await audio.play();
    } catch {
      status.textContent = "Pronunciation audio could not be played.";
    }
  });

  const imageLinks = [...document.querySelectorAll(".image-popup, a[href$='.jpg' i], a[href$='.jpeg' i], a[href$='.png' i], a[href$='.gif' i]")]
    .filter((link) => !link.closest(".page__comments, .js-comment"));
  if (!imageLinks.length) return;
  imageLinks.forEach((link) => link.classList.add("image-popup"));

  // Keep the first click working even while the optional viewer is downloading.
  const loaded = import(new URL("image-viewer.min.js", scriptUrl || document.baseURI).href)
    .then(() => true, () => false);
  async function waitForViewer(event) {
    const link = event.target.closest("a.image-popup");
    const modifiedClick = event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
    if (!imageLinks.includes(link) || modifiedClick) return;
    event.preventDefault();
    if (await loaded) link.click();
    else window.location.assign(link.href);
  }
  document.addEventListener("click", waitForViewer, true);
  loaded.then(() => document.removeEventListener("click", waitForViewer, true));
})();
