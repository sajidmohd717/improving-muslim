const form = document.querySelector("#feedback-form");
const email = document.querySelector("#feedback-email");
const message = document.querySelector("#feedback-message");
const status = document.querySelector("#feedback-status");
const fallback = document.querySelector("#feedback-fallback");
const feedbackCopy = document.querySelector("#feedback-copy");
const copyButton = document.querySelector("#copy-feedback");

function feedbackBody() {
  const replyTo = email.value.trim();
  return [
    message.value.trim(),
    "",
    "---",
    `Page: ${window.location.href}`,
    replyTo ? `Reply email: ${replyTo}` : "Reply email: not provided",
  ].join("\n");
}

function showFallback() {
  feedbackCopy.value = feedbackBody();
  fallback.classList.remove("is-hidden");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const feedback = message.value.trim();
  if (!feedback) {
    status.textContent = "Please write your feedback before sending.";
    return;
  }

  fallback.classList.add("is-hidden");
  status.textContent = "Sending...";

  const payload = new FormData(form);
  payload.set("page", window.location.href);

  try {
    const response = await fetch(form.action, {
      method: "POST",
      body: payload,
      headers: { Accept: "application/json" },
    });

    let result = null;
    try {
      result = await response.json();
    } catch (error) {
      result = null;
    }

    if (!response.ok || result?.success === false) {
      throw new Error(result?.message || "Feedback could not be sent.");
    }

    form.reset();
    status.textContent = "Feedback sent. JazakAllah khair for helping improve the platform.";
  } catch (error) {
    status.textContent = "Could not send automatically from this device.";
    showFallback();
  }
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(feedbackCopy.value);
    status.textContent = "Feedback copied. You can paste it into an email.";
  } catch (error) {
    feedbackCopy.focus();
    feedbackCopy.select();
    status.textContent = "Select and copy the message manually.";
  }
});
