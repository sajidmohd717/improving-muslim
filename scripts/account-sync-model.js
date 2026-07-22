/*
 * Pure account-sync merge rules. Keeping these independent from Firebase and
 * the DOM makes conflict handling deterministic and directly testable.
 */
(function () {
  'use strict';

  function newerValue(cloudValue, guestValue) {
    if (!cloudValue) return guestValue;
    if (!guestValue) return cloudValue;
    return (Number(guestValue.updatedAt) || 0) > (Number(cloudValue.updatedAt) || 0)
      ? guestValue
      : cloudValue;
  }

  function mergeProgressValue(cloudValue, guestValue) {
    var latest = Object.assign({}, newerValue(cloudValue, guestValue) || {});
    if ((cloudValue && cloudValue.completed) || (guestValue && guestValue.completed)) {
      latest.completed = true;
      latest.currentTime = Math.max(Number(cloudValue && cloudValue.currentTime) || 0, Number(guestValue && guestValue.currentTime) || 0);
      latest.duration = Math.max(Number(cloudValue && cloudValue.duration) || 0, Number(guestValue && guestValue.duration) || 0);
      latest.updatedAt = Math.max(Number(cloudValue && cloudValue.updatedAt) || 0, Number(guestValue && guestValue.updatedAt) || 0);
    }
    return latest;
  }

  function mergeStreak(cloudStreak, guestStreak) {
    cloudStreak = cloudStreak || {};
    guestStreak = guestStreak || {};
    var latest = Object.assign({}, newerValue(cloudStreak, guestStreak) || {});
    var days = Object.assign({}, cloudStreak.days || {});
    Object.keys(guestStreak.days || {}).forEach(function (date) {
      var cloudDay = days[date] || {};
      var guestDay = guestStreak.days[date] || {};
      days[date] = {
        seconds: Math.max(Number(cloudDay.seconds) || 0, Number(guestDay.seconds) || 0),
        completed: Boolean(cloudDay.completed || guestDay.completed),
      };
    });
    latest.days = days;
    latest.current = Math.max(Number(cloudStreak.current) || 0, Number(guestStreak.current) || 0);
    latest.best = Math.max(Number(cloudStreak.best) || 0, Number(guestStreak.best) || 0);
    latest.freezesAvailable = Math.max(Number(cloudStreak.freezesAvailable) || 0, Number(guestStreak.freezesAvailable) || 0);
    latest.lastCompletedDate = [cloudStreak.lastCompletedDate || '', guestStreak.lastCompletedDate || ''].sort().pop();
    if (cloudStreak.todayDate && cloudStreak.todayDate === guestStreak.todayDate) {
      latest.todayDate = cloudStreak.todayDate;
      latest.todaySeconds = Math.max(Number(cloudStreak.todaySeconds) || 0, Number(guestStreak.todaySeconds) || 0);
    }
    ['publicOptIn', 'publicName'].forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(cloudStreak, key)) latest[key] = cloudStreak[key];
      else delete latest[key];
    });
    latest.updatedAt = Math.max(Number(cloudStreak.updatedAt) || 0, Number(guestStreak.updatedAt) || 0);
    return latest;
  }

  function mergeQuranStreak(cloudStreak, guestStreak) {
    cloudStreak = cloudStreak || {};
    guestStreak = guestStreak || {};
    var latest = Object.assign({}, newerValue(cloudStreak, guestStreak) || {});
    var days = Object.assign({}, cloudStreak.days || {});
    Object.keys(guestStreak.days || {}).forEach(function (date) {
      var cloudDay = days[date] || {};
      var guestDay = guestStreak.days[date] || {};
      days[date] = {
        completed: Boolean(cloudDay.completed || guestDay.completed),
        minutes: Math.max(Number(cloudDay.minutes) || 0, Number(guestDay.minutes) || 0),
      };
    });
    latest.days = days;
    latest.current = Math.max(Number(cloudStreak.current) || 0, Number(guestStreak.current) || 0);
    latest.best = Math.max(Number(cloudStreak.best) || 0, Number(guestStreak.best) || 0, latest.current);
    latest.lastCompletedDate = [cloudStreak.lastCompletedDate || '', guestStreak.lastCompletedDate || ''].sort().pop();
    latest.targetMinutes = 15;
    latest.updatedAt = Math.max(Number(cloudStreak.updatedAt) || 0, Number(guestStreak.updatedAt) || 0);
    return latest;
  }

  function savedArrayFromCloud(cloud) {
    cloud = cloud || {};
    if (cloud.savedItems && typeof cloud.savedItems === 'object') {
      return Object.keys(cloud.savedItems)
        .map(function (key) { return cloud.savedItems[key]; })
        .filter(Boolean)
        .sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
    }
    return Array.isArray(cloud.saved) ? cloud.saved : [];
  }

  function mergePersonalData(cloud, guest) {
    cloud = cloud || {};
    guest = guest || {};
    var progress = Object.assign({}, cloud.progress || {});
    Object.keys(guest.progress || {}).forEach(function (key) {
      progress[key] = mergeProgressValue(progress[key], guest.progress[key]);
    });
    var notes = Object.assign({}, cloud.notes || {});
    Object.keys(guest.notes || {}).forEach(function (key) {
      notes[key] = newerValue(notes[key], guest.notes[key]);
    });
    var savedMap = {};
    savedArrayFromCloud(cloud).concat(Array.isArray(guest.saved) ? guest.saved : []).forEach(function (item) {
      if (!item || !item.key) return;
      var existing = savedMap[item.key];
      if (!existing || (Number(item.savedAt) || 0) > (Number(existing.savedAt) || 0)) savedMap[item.key] = item;
    });
    return {
      progress: progress,
      notes: notes,
      saved: Object.keys(savedMap).map(function (key) { return savedMap[key]; }).sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); }),
      streak: mergeStreak(cloud.streak || {}, guest.streak || {}),
      quranStreak: mergeQuranStreak(cloud.quranStreak || {}, guest.quranStreak || {}),
    };
  }

  function savedItemsByKey(raw) {
    var items;
    try { items = JSON.parse(raw || '[]'); } catch (_) { items = []; }
    var result = {};
    if (!Array.isArray(items)) return result;
    items.forEach(function (item) { if (item && item.key) result[item.key] = item; });
    return result;
  }

  function savedChangesBetween(previousRaw, currentRaw) {
    var previous = savedItemsByKey(previousRaw);
    var current = savedItemsByKey(currentRaw);
    var changes = {};
    Object.keys(previous).forEach(function (key) {
      if (!current[key]) changes[key] = null;
    });
    Object.keys(current).forEach(function (key) {
      if (!previous[key] || JSON.stringify(previous[key]) !== JSON.stringify(current[key])) changes[key] = current[key];
    });
    return changes;
  }

  window.IMAccountSyncModel = {
    newerValue: newerValue,
    mergeProgressValue: mergeProgressValue,
    mergeStreak: mergeStreak,
    mergeQuranStreak: mergeQuranStreak,
    mergePersonalData: mergePersonalData,
    savedArrayFromCloud: savedArrayFromCloud,
    savedItemsByKey: savedItemsByKey,
    savedChangesBetween: savedChangesBetween,
  };
})();
