window.IMHomeConfig = {
  apiRoot: "https://sajidmohd717.github.io/series-api",
  // Bump this value whenever the remote catalog JSON changes. The homepage
  // can then reuse cached data between releases while still reshuffling cards
  // on every page load.
  catalogVersion: "20260716-ep9-12",
  // Optional server-side AI reranking endpoint. Keep empty until a Cloudflare
  // Worker or other backend is deployed with a private API key.
  aiSearchEndpoint: "https://improving-muslim-ai-search.improving-muslim.workers.dev",

  categories: window.IMCategoryTaxonomy?.homepageFilters || [{ name: "All", value: "foryou" }],

  descriptions: {
    "Enjoy Your Prayer":
      "A step-by-step journey through salah, helping prayer become more present, meaningful, and loved.",
    "Why Me | 2024 Ramadan Series":
      "A reflective Ramadan series on hardship, divine decree, purpose, and learning to see tests through a more faithful lens.",
    "Change of Heart":
      "A series focused on the inner life: sincerity, repentance, discipline, and the work of returning the heart to Allah.",
    "Angels in Your Presence":
      "A study of angels and how belief in the unseen can reshape worship, character, and daily awareness.",
    "40 Hadith of Imam Nawawi":
      "Foundational hadith explained with practical lessons for worship, character, and daily decision-making.",
    "Seerah of Prophet Muhammed (S)":
      "A detailed walk through the Prophet's life, context, sacrifices, and guidance for the ummah.",
    "Fortress Of The Muslim":
      "Daily duas and adhkar from Hisnul Muslim, taught in a simple and memorable way.",
    "Madina Arabic":
      "A structured Arabic course for building grammar, vocabulary, and confidence with Islamic texts.",
  },

  // Remote API entries can include material that is intentionally absent from
  // this platform. Keep these lists centralized so homepage filtering is easy
  // to review without digging through rendering code.
  excludedSpeakerNames: [
    [117, 116, 104, 109, 97, 110, 32, 105, 98, 110, 32, 102, 97, 114, 111, 111, 113]
      .map((code) => String.fromCharCode(code))
      .join(""),
  ],

  excludedSeriesTitles: [
    "the message of the quran in 30 lessons",
    "the parables of the quran",
    "wisdoms of the quran - ramadan series 2024",
    "heart matters ramadan series 2023",
  ],
};
