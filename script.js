const lightbox = document.querySelector(".lightbox");
const lightboxImage = lightbox?.querySelector("img");
const closeButton = lightbox?.querySelector(".lightbox-close");
const galleryToggle = document.querySelector(".gallery-toggle");
const gallery = document.querySelector(".gallery:not(.gallery-extra)");
const galleryExtra = document.querySelector("#gallery-extra");
const revealTargets = document.querySelectorAll(
  ".section-heading, .feature, .qualification-list li, .teacher-copy, .teacher-strip, .review-card, .venue-copy, .contact-card, .map-wrap, .flyer-frame"
);
const scrollMotionTargets = document.querySelectorAll(".section-band, .classes, .reviews, .gallery-section, .contact");
const floatingDecorations = document.querySelectorAll(".asset-splatter, .paint-note, .hero-photo");
const isMobileViewport = () => window.matchMedia("(max-width: 620px)").matches;
let galleryAutoScrollId;
let galleryWasDragged = false;
let scrollFrameId;

const revealElement = (element, index = 0) => {
  element.classList.add("reveal-in");
  element.style.transitionDelay = `${Math.min(index * 36, 260)}ms`;
};

revealTargets.forEach((element, index) => revealElement(element, index));

const revealVisibleNow = () => {
  revealTargets.forEach((element) => {
    const rect = element.getBoundingClientRect();
    const triggerPoint = isMobileViewport() ? 1.22 : 0.94;
    const bottomLimit = isMobileViewport() ? -window.innerHeight * 0.18 : window.innerHeight * 0.08;
    if (rect.top < window.innerHeight * triggerPoint && rect.bottom > bottomLimit) {
      element.classList.add("is-visible");
    }
  });
};

revealVisibleNow();

if ("IntersectionObserver" in window) {
  const revealObserverOptions = isMobileViewport()
    ? { threshold: 0.01, rootMargin: "0px 0px 220px 0px" }
    : { threshold: 0.08, rootMargin: "0px 0px 80px" };

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    },
    revealObserverOptions
  );

  revealTargets.forEach((element) => revealObserver.observe(element));
} else {
  revealTargets.forEach((element) => element.classList.add("is-visible"));
}

const updateScrollAnimations = () => {
  scrollFrameId = undefined;
  const viewportHeight = window.innerHeight || 1;

  scrollMotionTargets.forEach((element) => {
    const rect = element.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, 1 - rect.top / viewportHeight));
    const centered = Math.min(1, Math.max(0, (viewportHeight - Math.abs(rect.top + rect.height / 2 - viewportHeight / 2)) / viewportHeight));
    element.style.setProperty("--scroll-progress", progress.toFixed(3));
    element.style.setProperty("--scroll-center", centered.toFixed(3));
    const activeTop = isMobileViewport() ? 0.68 : 0.86;
    const activeBottom = isMobileViewport() ? 0.18 : 0.12;
    element.classList.toggle("is-scroll-active", rect.top < viewportHeight * activeTop && rect.bottom > viewportHeight * activeBottom);
  });

  floatingDecorations.forEach((element, index) => {
    const rect = element.getBoundingClientRect();
    const drift = Math.max(-1, Math.min(1, (viewportHeight / 2 - (rect.top + rect.height / 2)) / viewportHeight));
    element.style.setProperty("--float-drift", (drift * (index % 2 ? -1 : 1)).toFixed(3));
  });
};

const scheduleScrollAnimations = () => {
  if (scrollFrameId) {
    return;
  }

  scrollFrameId = window.requestAnimationFrame(updateScrollAnimations);
};

updateScrollAnimations();
window.addEventListener("scroll", scheduleScrollAnimations, { passive: true });
window.addEventListener("resize", scheduleScrollAnimations, { passive: true });

document.addEventListener("click", (event) => {
  const button = event.target.closest(".gallery-item, .poster-trigger");
  if (!button) {
    return;
  }

  if (button.classList.contains("gallery-item") && galleryWasDragged) {
    event.preventDefault();
    galleryWasDragged = false;
    return;
  }

  const image = button.querySelector("img");
  const fullImage = button.dataset.full || image?.src;

  if (!lightbox || !lightboxImage || !fullImage) {
    return;
  }

  lightboxImage.src = fullImage;
  lightboxImage.alt = image?.alt || "Artwork gallery image";
  lightbox.showModal();
});

galleryToggle?.addEventListener("click", () => {
  if (!galleryExtra) {
    return;
  }

  const isExpanded = galleryToggle.getAttribute("aria-expanded") === "true";
  galleryToggle.setAttribute("aria-expanded", String(!isExpanded));
  galleryExtra.hidden = isExpanded;
  galleryToggle.textContent = isExpanded ? "Show more artwork" : "Show less artwork";

  if (isExpanded) {
    galleryExtra.classList.remove("is-open");
    return;
  }

  requestAnimationFrame(() => {
    galleryExtra.classList.add("is-open");
    galleryExtra.querySelectorAll(".gallery-item").forEach((item, index) => {
      revealElement(item, index);
      requestAnimationFrame(() => item.classList.add("is-visible"));
    });
  });
});

const setupGallerySlider = () => {
  if (!gallery || !galleryExtra) {
    return;
  }

  gallery.querySelectorAll("img").forEach((image) => {
    image.loading = "lazy";
    image.decoding = "async";
  });

  if (!gallery.dataset.merged) {
    galleryExtra.querySelectorAll(".gallery-item").forEach((item, index) => {
      const image = item.querySelector("img");
      if (image) {
        image.loading = "lazy";
        image.decoding = "async";
      }
      gallery.appendChild(item);
      revealElement(item, index);
      item.classList.add("is-visible");
    });
    gallery.dataset.merged = "true";
  }

  galleryExtra.hidden = true;
  galleryToggle?.setAttribute("aria-expanded", "true");
  gallery.classList.add("is-auto-slider");

  if (galleryAutoScrollId) {
    return;
  }

  let paused = false;
  let resumeTimer;
  let position = gallery.scrollLeft;
  let lastFrame = performance.now();
  let loopPoint = 0;
  let galleryIsVisible = true;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartScroll = 0;
  let dragDistance = 0;
  let scrollSyncFrame;

  const getOriginalItems = () => [...gallery.querySelectorAll(".gallery-item:not([data-clone])")];

  const appendCloneSet = (items) => {
    items.forEach((item) => {
      const clone = item.cloneNode(true);
      clone.dataset.clone = "true";
      clone.setAttribute("aria-hidden", "true");
      clone.classList.add("is-visible");
      clone.tabIndex = -1;
      const image = clone.querySelector("img");
      if (image) {
        image.loading = "lazy";
        image.decoding = "async";
      }
      gallery.appendChild(clone);
    });
  };

  const wrapPosition = (value) => {
    if (!loopPoint) {
      return value;
    }

    return ((value % loopPoint) + loopPoint) % loopPoint;
  };

  const updateLoopPoint = () => {
    gallery.querySelectorAll(".gallery-item[data-clone]").forEach((clone) => clone.remove());

    const originalItems = getOriginalItems();
    const first = originalItems[0];
    const last = originalItems.at(-1);
    const gap = parseFloat(getComputedStyle(gallery).columnGap) || 0;
    loopPoint = first && last ? last.offsetLeft + last.offsetWidth - first.offsetLeft + gap : gallery.scrollWidth / 2;

    if (!originalItems.length) {
      return;
    }

    let cloneSets = 0;
    do {
      appendCloneSet(originalItems);
      cloneSets += 1;
    } while (cloneSets < 4 && gallery.scrollWidth < loopPoint + gallery.clientWidth * 2);

    position = wrapPosition(gallery.scrollLeft);
    gallery.scrollLeft = position;
    gallery.querySelectorAll(".gallery-item").forEach((item) => item.classList.add("is-visible"));
  };

  const pause = () => {
    paused = true;
    window.clearTimeout(resumeTimer);
    resumeTimer = window.setTimeout(() => {
      paused = false;
    }, 1300);
  };

  const normalizePosition = () => {
    if (!loopPoint) {
      position = gallery.scrollLeft;
      return;
    }

    position = wrapPosition(gallery.scrollLeft);
    gallery.scrollLeft = position;
  };

  gallery.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    pause();
    isDragging = true;
    dragStartX = event.clientX;
    dragStartScroll = gallery.scrollLeft;
    dragDistance = 0;
    gallery.classList.add("is-dragging");
    gallery.setPointerCapture?.(event.pointerId);
  });

  gallery.addEventListener("pointermove", (event) => {
    if (!isDragging) {
      return;
    }

    event.preventDefault();
    const distance = event.clientX - dragStartX;
    dragDistance = Math.max(dragDistance, Math.abs(distance));
    gallery.scrollLeft = dragStartScroll - distance;
    normalizePosition();
  });

  const finishDrag = (event) => {
    if (!isDragging) {
      return;
    }

    isDragging = false;
    gallery.classList.remove("is-dragging");
    gallery.releasePointerCapture?.(event.pointerId);
    galleryWasDragged = dragDistance > 8;
    normalizePosition();
    pause();
  };

  gallery.addEventListener("pointerup", finishDrag);
  gallery.addEventListener("pointercancel", finishDrag);
  gallery.addEventListener(
    "scroll",
    () => {
      if (scrollSyncFrame) {
        return;
      }

      scrollSyncFrame = window.requestAnimationFrame(() => {
        scrollSyncFrame = undefined;
        if (paused || isDragging) {
          normalizePosition();
          return;
        }

        position = gallery.scrollLeft;
      });
    },
    { passive: true }
  );
  gallery.addEventListener("wheel", () => {
    pause();
    window.requestAnimationFrame(normalizePosition);
  }, { passive: true });
  gallery.addEventListener("focusin", pause);
  window.addEventListener("resize", updateLoopPoint, { passive: true });
  window.addEventListener("load", updateLoopPoint, { once: true });
  updateLoopPoint();

  if ("IntersectionObserver" in window) {
    const galleryObserver = new IntersectionObserver(
      ([entry]) => {
        galleryIsVisible = entry.isIntersecting;
        if (galleryIsVisible) {
          updateLoopPoint();
        }
        lastFrame = performance.now();
        position = gallery.scrollLeft;
      },
      { threshold: 0.15 }
    );
    galleryObserver.observe(gallery);
  }

  const tick = (now) => {
    galleryAutoScrollId = window.requestAnimationFrame(tick);
    if (paused || isDragging || !galleryIsVisible || document.hidden || gallery.scrollWidth <= gallery.clientWidth) {
      lastFrame = now;
      return;
    }

    const delta = Math.min(now - lastFrame, 80);
    lastFrame = now;
    position += delta * 0.05;

    position = wrapPosition(position);
    gallery.scrollLeft = position;
  };

  galleryAutoScrollId = window.requestAnimationFrame(tick);
};

setupGallerySlider();

closeButton?.addEventListener("click", () => {
  lightbox?.close();
});

lightbox?.addEventListener("click", (event) => {
  if (event.target === lightbox) {
    lightbox.close();
  }
});

