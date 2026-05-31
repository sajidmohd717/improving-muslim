const FEEDBACK_EMAIL = "feedback@improvingmuslim.com";

const form = document.querySelector("#feedback-form");
const email = document.querySelector("#feedback-email");
const message = document.querySelector("#feedback-message");
const status = document.querySelector("#feedback-status");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const feedback = message.value.trim();
  if (!feedback) {
    status.textContent = "Please write your feedback before sending.";
    return;
  }

  const replyTo = email.value.trim();
  const body = [
    feedback,
    "",
    "---",
    `Page: ${window.location.href}`,
    replyTo ? `Reply email: ${replyTo}` : "Reply email: not provided",
  ].join("\n");

  const mailto = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent("Improving Muslim feedback")}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;
  status.textContent = "Your email app should open with the feedback ready to send.";
});
