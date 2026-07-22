/* Homepage topic-chip rendering and horizontal carousel behavior. */
(() => {
  "use strict";

  function create({ state, els, categories, escapeHtml }) {
    function updateScrollButtons() {
      if (!els.categoryList) return;
      const maxScroll = Math.max(0, els.categoryList.scrollWidth - els.categoryList.clientWidth);
      const atStart = els.categoryList.scrollLeft <= 2;
      const atEnd = els.categoryList.scrollLeft >= maxScroll - 2;
      if (els.categoryScrollPrevious) els.categoryScrollPrevious.disabled = atStart;
      if (els.categoryScrollNext) els.categoryScrollNext.disabled = atEnd;
    }

    function keepActiveVisible() {
      const active = els.categoryList?.querySelector(".category-button.is-active");
      if (!active) return;
      const listLeft = els.categoryList.scrollLeft;
      const listRight = listLeft + els.categoryList.clientWidth;
      const buttonLeft = active.offsetLeft;
      const buttonRight = buttonLeft + active.offsetWidth;
      if (buttonLeft < listLeft) {
        els.categoryList.scrollLeft = buttonLeft;
      } else if (buttonRight > listRight) {
        els.categoryList.scrollLeft = buttonRight - els.categoryList.clientWidth;
      }
    }

    function render() {
      if (!els.categoryList) return;
      els.categoryList.innerHTML = categories
        .map(
          (category) => `
            <button
              class="category-button ${category.value === state.activeCategory ? "is-active" : ""}"
              type="button"
              data-category="${category.value}"
            >
              ${escapeHtml(category.name)}
            </button>
          `,
        )
        .join("");
      window.requestAnimationFrame(() => {
        keepActiveVisible();
        updateScrollButtons();
      });
    }

    function scroll(direction) {
      if (!els.categoryList) return;
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      els.categoryList.scrollBy({
        left: direction * Math.max(260, els.categoryList.clientWidth * 0.72),
        behavior: reduceMotion ? "auto" : "smooth",
      });
    }

    return { render, scroll, updateScrollButtons };
  }

  window.IMHomeCategoryNav = { create };
})();
