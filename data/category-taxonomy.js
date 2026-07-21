/*
 * Canonical category taxonomy shared by the homepage, Explore, search labels,
 * and authoring validation. Add or rename public topics here rather than
 * maintaining separate lists in page controllers.
 */
(function () {
  "use strict";

  var systemFilters = [
    { name: "All", value: "foryou" },
    { name: "Available now", value: "available" },
  ];

  var topics = [
    {
      name: "Purification",
      value: "purification",
      description: "Heart work, hardship, patience, and returning to Allah.",
      aliases: ["tazkiyah", "heart softening", "spirituality"],
      public: true,
    },
    {
      name: "Prayer",
      value: "prayer",
      description: "Build focus, love, and consistency in salah.",
      aliases: ["salah", "salat", "khushu"],
      public: true,
    },
    {
      name: "Dhikr",
      value: "dhikr",
      description: "Daily remembrance, duas, and worship routines.",
      aliases: ["dua", "adhkar", "remembrance", "supplication"],
      public: true,
    },
    {
      name: "Hadith",
      value: "hadith",
      description: "Foundational narrations, character, and prophetic guidance.",
      aliases: ["sunnah", "narrations"],
      public: true,
    },
    {
      name: "Seerah",
      value: "seerah",
      description: "Walk through the life and mission of Prophet Muhammad.",
      aliases: ["sirah", "prophetic biography", "life of muhammad"],
      public: true,
    },
    {
      name: "Sahaba",
      value: "sahaba",
      description: "Stories and virtues of the companions.",
      aliases: ["companions", "sahabah"],
      public: true,
    },
    {
      name: "Righteous Predecessors",
      value: "righteous-predecessors",
      description: "Lives and lessons of the salaf — companions, scholars, and the early generations.",
      aliases: ["salaf", "salaf as-salih", "pious predecessors", "early generations"],
      public: true,
    },
    {
      name: "Quran",
      value: "quran",
      description: "Reflection, recitation, and lessons from revelation.",
      aliases: ["qur'an", "koran", "revelation"],
      public: true,
    },
    {
      name: "Tafsir",
      value: "tafsir",
      description: "Deeper meanings and commentary on the Quran.",
      aliases: ["tafseer", "quran commentary", "exegesis"],
      public: true,
    },
    {
      name: "Aqeedah",
      value: "aqeedah",
      description: "Core beliefs and clarity about faith.",
      aliases: ["aqidah", "creed", "belief"],
      public: true,
    },
    {
      name: "Prophets",
      value: "prophets",
      description: "Stories and lessons from the lives of Allah's prophets.",
      aliases: ["anbiya", "stories of the prophets"],
      public: true,
    },
    {
      name: "Angels",
      value: "angels",
      description: "Learn about the unseen and the angels around us.",
      aliases: ["malaika", "unseen"],
      public: true,
    },
    {
      name: "Arabic",
      value: "arabic",
      description: "Build language foundations for understanding Islamic texts.",
      aliases: ["arabic language", "nahw", "sarf"],
      public: true,
    },
    {
      name: "Fiqh",
      value: "fiqh",
      description: "Practical guidance for worship, family, and everyday rulings.",
      aliases: ["islamic law", "jurisprudence", "rulings"],
      public: true,
    },
    {
      name: "Hereafter",
      value: "hereafter",
      description: "Death, accountability, Jannah, and preparing well.",
      aliases: ["akhirah", "jannah", "judgement day", "afterlife"],
      public: true,
    },
  ];

  window.IMCategoryTaxonomy = {
    systemFilters: systemFilters,
    topics: topics,
    homepageFilters: systemFilters.concat(
      topics.filter(function (topic) { return topic.public; }).map(function (topic) {
        return { name: topic.name, value: topic.value };
      }),
    ),
  };
})();
