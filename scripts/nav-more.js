const trigger = document.getElementById("nav-more-trigger");
const menu = document.getElementById("nav-more-menu");

if (trigger && menu) {
  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = trigger.getAttribute("aria-expanded") === "true";
    trigger.setAttribute("aria-expanded", String(!open));
    menu.hidden = open;
  });

  document.addEventListener("click", () => {
    trigger.setAttribute("aria-expanded", "false");
    menu.hidden = true;
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) {
      trigger.setAttribute("aria-expanded", "false");
      menu.hidden = true;
      trigger.focus();
    }
  });
}
