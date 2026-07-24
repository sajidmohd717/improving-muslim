/*
 * Progressive custom controls for the watch-page <video>.
 *
 * The native media element remains the playback engine. Its `controls`
 * attribute stays in the HTML as a no-JavaScript/error fallback and is only
 * disabled after this module has initialized successfully. Add
 * `?nativePlayer=1` to any watch URL to force the browser controls.
 */
(function () {
  "use strict";

  if (new URLSearchParams(window.location.search).get("nativePlayer") === "1") return;

  const frame = document.querySelector(".video-frame");
  const video = document.querySelector("#video-player");
  const ui = document.querySelector("#player-ui");
  const surface = document.querySelector("#player-surface");
  const centerToggle = document.querySelector("#player-center-toggle");
  const playToggle = document.querySelector("#player-play-toggle");
  const muteToggle = document.querySelector("#player-mute-toggle");
  const volume = document.querySelector("#player-volume");
  const timeline = document.querySelector("#player-timeline");
  const timelineWrap = document.querySelector("#player-timeline-wrap");
  const timePreview = document.querySelector("#player-time-preview");
  const currentTimeLabel = document.querySelector("#player-current-time");
  const durationLabel = document.querySelector("#player-duration");
  const captionsToggle = document.querySelector("#player-captions-toggle");
  const speedToggle = document.querySelector("#player-speed-toggle");
  const speedLabel = document.querySelector("#player-speed-label");
  const speedMenu = document.querySelector("#player-speed-menu");
  const pipToggle = document.querySelector("#player-pip-toggle");
  const fullscreenToggle = document.querySelector("#player-fullscreen-toggle");
  const status = document.querySelector("#player-status");
  const seekBack = document.querySelector("#player-seek-back");
  const seekForward = document.querySelector("#player-seek-forward");

  const required = [
    frame,
    video,
    ui,
    surface,
    centerToggle,
    playToggle,
    muteToggle,
    volume,
    timeline,
    timelineWrap,
    timePreview,
    currentTimeLabel,
    durationLabel,
    captionsToggle,
    speedToggle,
    speedLabel,
    speedMenu,
    pipToggle,
    fullscreenToggle,
    status,
  ];
  if (required.some((element) => !element)) return;

  // If the shared stylesheet is unavailable, leave the hidden custom markup
  // alone and keep the browser's native controls fully usable.
  frame.classList.add("has-custom-controls");
  const customStylesReady = window.getComputedStyle(ui).position === "absolute";
  frame.classList.remove("has-custom-controls");
  if (!customStylesReady) return;

  let controlsTimer = null;
  let statusTimer = null;
  let seekFeedbackTimer = null;
  let lastVolume = 1;
  let timelineActive = false;
  let keyboardInteraction = false;
  let mouseInside = false;

  function formatTime(value) {
    const seconds = Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    if (hours) return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  }

  function finiteDuration() {
    return Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
  }

  function hasMediaSource() {
    return Boolean(video.currentSrc || video.querySelector("source")?.getAttribute("src"));
  }

  function announce(message) {
    clearTimeout(statusTimer);
    status.textContent = "";
    window.requestAnimationFrame(() => {
      status.textContent = message;
      statusTimer = setTimeout(() => {
        status.textContent = "";
      }, 1600);
    });
  }

  function setControlsVisible(visible) {
    frame.classList.toggle("controls-hidden", !visible);
    frame.classList.toggle("controls-visible", visible);
  }

  function scheduleControlsHide() {
    clearTimeout(controlsTimer);
    const preserveKeyboardFocus = keyboardInteraction && frame.contains(document.activeElement);
    if (mouseInside || preserveKeyboardFocus || speedMenu.hidden === false || timelineActive) {
      setControlsVisible(true);
      return;
    }
    controlsTimer = setTimeout(() => {
      const keepKeyboardFocus = keyboardInteraction && frame.contains(document.activeElement);
      if (!mouseInside && !keepKeyboardFocus && speedMenu.hidden && !timelineActive) {
        setControlsVisible(false);
      }
    }, 2600);
  }

  function hideControlsIfIdle() {
    clearTimeout(controlsTimer);
    const preserveKeyboardFocus = keyboardInteraction && frame.contains(document.activeElement);
    if (preserveKeyboardFocus || speedMenu.hidden === false || timelineActive) {
      setControlsVisible(true);
      return;
    }
    setControlsVisible(false);
  }

  function showControls() {
    setControlsVisible(true);
    scheduleControlsHide();
  }

  function updatePlayState() {
    const isPlaying = !video.paused && !video.ended;
    frame.classList.toggle("is-playing", isPlaying);
    frame.classList.toggle("is-paused", !isPlaying && !video.ended);
    frame.classList.toggle("is-ended", video.ended);

    const label = video.ended ? "Replay video" : isPlaying ? "Pause video" : "Play video";
    const tooltip = video.ended ? "Replay" : isPlaying ? "Pause (K)" : "Play (K)";
    playToggle.setAttribute("aria-label", label);
    playToggle.dataset.tooltip = tooltip;
    centerToggle.setAttribute("aria-label", label);
    surface.setAttribute("aria-label", label);
    if (!isPlaying) showControls();
  }

  function togglePlayback() {
    if (!hasMediaSource()) return;
    if (video.ended && finiteDuration()) video.currentTime = 0;
    if (video.paused || video.ended) {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          updatePlayState();
        });
      }
    } else {
      video.pause();
    }
  }

  function updateTimeline() {
    const duration = finiteDuration();
    const current = duration ? Math.min(video.currentTime || 0, duration) : 0;
    const played = duration ? (current / duration) * 100 : 0;
    let buffered = 0;

    if (duration && video.buffered?.length) {
      for (let index = 0; index < video.buffered.length; index += 1) {
        buffered = Math.max(buffered, Math.min(100, (video.buffered.end(index) / duration) * 100));
      }
    }

    timelineWrap.style.setProperty("--player-played", `${played}%`);
    timelineWrap.style.setProperty("--player-buffered", `${buffered}%`);
    if (!timelineActive) timeline.value = duration ? String(Math.round((current / duration) * 1000)) : "0";
    currentTimeLabel.textContent = formatTime(current);
    durationLabel.textContent = formatTime(duration);
    timeline.setAttribute("aria-valuetext", `${formatTime(current)} of ${formatTime(duration)}`);
    timeline.disabled = !duration;
  }

  function seekTo(seconds, shouldAnnounce = false) {
    const duration = finiteDuration();
    if (!duration) return;
    video.currentTime = Math.min(duration, Math.max(0, seconds));
    updateTimeline();
    if (shouldAnnounce) announce(`Moved to ${formatTime(video.currentTime)}`);
  }

  function showSeekFeedback(direction) {
    const element = direction < 0 ? seekBack : seekForward;
    if (!element) return;
    clearTimeout(seekFeedbackTimer);
    seekBack?.classList.remove("is-showing");
    seekForward?.classList.remove("is-showing");
    element.classList.add("is-showing");
    seekFeedbackTimer = setTimeout(() => element.classList.remove("is-showing"), 620);
  }

  function seekBy(seconds) {
    if (!finiteDuration()) return;
    seekTo((video.currentTime || 0) + seconds);
    showSeekFeedback(seconds < 0 ? -1 : 1);
    announce(`${seconds < 0 ? "Rewound" : "Skipped"} ${Math.abs(seconds)} seconds`);
    showControls();
  }

  function updateVolumeState() {
    const silent = video.muted || video.volume === 0;
    frame.classList.toggle("is-muted", silent);
    volume.value = silent ? "0" : String(video.volume);
    volume.style.setProperty("--player-volume", `${(silent ? 0 : video.volume) * 100}%`);
    muteToggle.setAttribute("aria-label", silent ? "Unmute video" : "Mute video");
    muteToggle.dataset.tooltip = silent ? "Unmute (M)" : "Mute (M)";
  }

  function toggleMuted() {
    if (video.muted || video.volume === 0) {
      video.muted = false;
      video.volume = Math.max(0.05, lastVolume || 1);
      announce("Sound on");
    } else {
      lastVolume = video.volume;
      video.muted = true;
      announce("Muted");
    }
  }

  function captionTrack() {
    return Array.from(video.textTracks || []).find((track) =>
      track.kind === "captions" || track.kind === "subtitles"
    ) || null;
  }

  function updateCaptionsState() {
    const track = captionTrack();
    const available = Boolean(track && document.querySelector("#caption-track")?.getAttribute("src"));
    const enabled = available && track.mode === "showing";
    captionsToggle.hidden = !available;
    captionsToggle.disabled = !available;
    captionsToggle.classList.toggle("is-active", enabled);
    captionsToggle.setAttribute("aria-pressed", String(enabled));
    captionsToggle.setAttribute("aria-label", enabled ? "Turn captions off" : "Turn captions on");
  }

  function toggleCaptions() {
    const track = captionTrack();
    if (!track) return;
    track.mode = track.mode === "showing" ? "disabled" : "showing";
    updateCaptionsState();
    announce(track.mode === "showing" ? "Captions on" : "Captions off");
  }

  function speedText(rate) {
    return rate === 1 ? "1×" : `${rate}×`;
  }

  function updateSpeedState() {
    const rate = Number(video.playbackRate) || 1;
    speedLabel.textContent = speedText(rate);
    speedToggle.setAttribute("aria-label", rate === 1 ? "Playback speed, normal" : `Playback speed, ${rate} times`);
    speedMenu.querySelectorAll("[data-speed]").forEach((button) => {
      button.setAttribute("aria-checked", String(Number(button.dataset.speed) === rate));
    });
  }

  function closeSpeedMenu(restoreFocus = false) {
    if (speedMenu.hidden) return;
    speedMenu.hidden = true;
    speedToggle.setAttribute("aria-expanded", "false");
    if (restoreFocus) speedToggle.focus();
    scheduleControlsHide();
  }

  function openSpeedMenu() {
    speedMenu.hidden = false;
    speedToggle.setAttribute("aria-expanded", "true");
    setControlsVisible(true);
    clearTimeout(controlsTimer);
    const selected = speedMenu.querySelector('[aria-checked="true"]') || speedMenu.querySelector("[data-speed]");
    selected?.focus();
  }

  function updatePipState() {
    const supported = Boolean(
      document.pictureInPictureEnabled
      && typeof video.requestPictureInPicture === "function"
      && !video.disablePictureInPicture
    );
    pipToggle.hidden = !supported;
    const active = document.pictureInPictureElement === video;
    pipToggle.classList.toggle("is-active", active);
    pipToggle.setAttribute("aria-label", active ? "Exit Picture in Picture" : "Enter Picture in Picture");
  }

  async function togglePip() {
    try {
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture();
      } else if (typeof video.requestPictureInPicture === "function") {
        await video.requestPictureInPicture();
      }
    } catch {
      announce("Picture in Picture is unavailable");
    }
    updatePipState();
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function updateFullscreenState() {
    const active = fullscreenElement() === frame || Boolean(video.webkitDisplayingFullscreen);
    frame.classList.toggle("is-fullscreen", active);
    fullscreenToggle.setAttribute("aria-label", active ? "Exit fullscreen" : "Enter fullscreen");
    fullscreenToggle.dataset.tooltip = active ? "Exit fullscreen (F)" : "Fullscreen (F)";
    showControls();
  }

  async function toggleFullscreen() {
    try {
      if (fullscreenElement()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) await exit.call(document);
      } else if (frame.requestFullscreen) {
        await frame.requestFullscreen();
      } else if (frame.webkitRequestFullscreen) {
        frame.webkitRequestFullscreen();
      } else if (typeof video.webkitEnterFullscreen === "function") {
        video.webkitEnterFullscreen();
      } else {
        announce("Fullscreen is unavailable");
      }
    } catch {
      announce("Fullscreen is unavailable");
    }
  }

  function previewTimeline(event) {
    const duration = finiteDuration();
    if (!duration) return;
    const rect = timeline.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    timePreview.textContent = formatTime(ratio * duration);
    timelineWrap.style.setProperty("--player-preview", `${ratio * 100}%`);
    timelineWrap.classList.add("is-previewing");
  }

  function isEditableTarget(target) {
    if (!(target instanceof Element)) return false;

    // Player controls should keep the global media shortcuts active after a
    // click. Outside the player, protect form fields and controls so arrows and
    // letter shortcuts still behave normally while someone types or navigates.
    if (target.closest(".video-frame")) return false;
    return Boolean(target.closest("input, textarea, select, button, [contenteditable]"));
  }

  playToggle.addEventListener("click", togglePlayback);
  centerToggle.addEventListener("click", togglePlayback);
  surface.addEventListener("click", togglePlayback);
  muteToggle.addEventListener("click", toggleMuted);
  captionsToggle.addEventListener("click", toggleCaptions);
  pipToggle.addEventListener("click", togglePip);
  fullscreenToggle.addEventListener("click", toggleFullscreen);

  volume.addEventListener("input", () => {
    const nextVolume = Math.min(1, Math.max(0, Number(volume.value) || 0));
    video.volume = nextVolume;
    video.muted = nextVolume === 0;
    if (nextVolume > 0) lastVolume = nextVolume;
  });

  timeline.addEventListener("input", () => {
    const duration = finiteDuration();
    if (!duration) return;
    timelineActive = true;
    seekTo((Number(timeline.value) / 1000) * duration);
  });
  timeline.addEventListener("change", () => {
    timelineActive = false;
    announce(`Moved to ${formatTime(video.currentTime)}`);
    scheduleControlsHide();
  });
  timeline.addEventListener("pointerdown", () => {
    timelineActive = true;
    setControlsVisible(true);
    clearTimeout(controlsTimer);
  });
  timeline.addEventListener("pointerup", () => {
    timelineActive = false;
    scheduleControlsHide();
  });
  timeline.addEventListener("pointermove", previewTimeline);
  timeline.addEventListener("pointerleave", () => timelineWrap.classList.remove("is-previewing"));
  timeline.addEventListener("focus", () => timelineWrap.classList.add("is-focused"));
  timeline.addEventListener("blur", () => timelineWrap.classList.remove("is-focused"));

  speedToggle.addEventListener("click", () => {
    if (speedMenu.hidden) openSpeedMenu();
    else closeSpeedMenu(true);
  });
  speedMenu.addEventListener("click", (event) => {
    const option = event.target.closest("[data-speed]");
    if (!option) return;
    video.playbackRate = Number(option.dataset.speed) || 1;
    updateSpeedState();
    announce(video.playbackRate === 1 ? "Normal playback speed" : `${video.playbackRate} times playback speed`);
    closeSpeedMenu(true);
  });
  speedMenu.addEventListener("keydown", (event) => {
    const options = Array.from(speedMenu.querySelectorAll("[data-speed]"));
    const index = options.indexOf(document.activeElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      options[(index + delta + options.length) % options.length]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeSpeedMenu(true);
    }
  });

  document.addEventListener("click", (event) => {
    if (!speedMenu.hidden && !speedMenu.contains(event.target) && !speedToggle.contains(event.target)) {
      closeSpeedMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    keyboardInteraction = true;
    if (isEditableTarget(event.target)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (!hasMediaSource()) return;

    const key = event.key.toLowerCase();
    if (event.key === " " || key === "k") {
      event.preventDefault();
      event.stopPropagation();
      togglePlayback();
    } else if (event.key === "ArrowLeft" || key === "j") {
      event.preventDefault();
      event.stopPropagation();
      seekBy(-10);
    } else if (event.key === "ArrowRight" || key === "l") {
      event.preventDefault();
      event.stopPropagation();
      seekBy(10);
    } else if (key === "m") {
      event.preventDefault();
      toggleMuted();
    } else if (key === "f") {
      event.preventDefault();
      toggleFullscreen();
    } else if (key === "c" && !captionsToggle.hidden) {
      event.preventDefault();
      toggleCaptions();
    } else if (event.key === "Escape" && !speedMenu.hidden) {
      closeSpeedMenu(true);
    }
  }, true);

  frame.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse") mouseInside = true;
    showControls();
  }, { passive: true });
  frame.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse") mouseInside = true;
    showControls();
  }, { passive: true });
  frame.addEventListener("pointerdown", (event) => {
    keyboardInteraction = false;
    if (event.pointerType === "mouse") mouseInside = true;
    showControls();
  });
  frame.addEventListener("touchstart", showControls, { passive: true });
  frame.addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "mouse") return;
    mouseInside = false;
    hideControlsIfIdle();
  }, { passive: true });
  frame.addEventListener("focusin", () => {
    clearTimeout(controlsTimer);
    setControlsVisible(true);
  });
  frame.addEventListener("focusout", () => window.setTimeout(scheduleControlsHide, 0));

  video.addEventListener("play", () => {
    frame.classList.add("has-started");
    updatePlayState();
  });
  video.addEventListener("playing", () => {
    frame.classList.remove("is-buffering");
    updatePlayState();
    scheduleControlsHide();
  });
  video.addEventListener("pause", updatePlayState);
  video.addEventListener("ended", updatePlayState);
  video.addEventListener("waiting", () => frame.classList.add("is-buffering"));
  video.addEventListener("canplay", () => frame.classList.remove("is-buffering"));
  video.addEventListener("loadedmetadata", () => {
    updateTimeline();
    window.setTimeout(updateCaptionsState, 0);
  });
  video.addEventListener("durationchange", updateTimeline);
  video.addEventListener("timeupdate", updateTimeline);
  video.addEventListener("progress", updateTimeline);
  video.addEventListener("volumechange", updateVolumeState);
  video.addEventListener("ratechange", updateSpeedState);
  video.addEventListener("enterpictureinpicture", updatePipState);
  video.addEventListener("leavepictureinpicture", updatePipState);
  document.addEventListener("fullscreenchange", updateFullscreenState);
  document.addEventListener("webkitfullscreenchange", updateFullscreenState);
  video.addEventListener("webkitbeginfullscreen", updateFullscreenState);
  video.addEventListener("webkitendfullscreen", updateFullscreenState);

  updatePlayState();
  updateTimeline();
  updateVolumeState();
  updateSpeedState();
  updatePipState();
  updateCaptionsState();
  setControlsVisible(true);
  scheduleControlsHide();

  // Native controls disappear only after every required custom control exists
  // and all event listeners above have been attached successfully.
  frame.classList.add("has-custom-controls");
  ui.hidden = false;
  video.controls = false;

  window.IMCustomVideoPlayer = {
    initialized: true,
    showControls,
    seekBy,
    togglePlayback,
    toggleFullscreen,
  };
})();
