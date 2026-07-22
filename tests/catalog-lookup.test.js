import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadLookup() {
  const window = {
    catalogIndex: {
      items: [
        {
          kind: "episode",
          series: "sample-series",
          playlistId: "sample-playlist",
          id: "episode-1",
          title: "First episode",
          thumb: "./episode.jpg",
        },
        {
          kind: "standalone",
          playlistId: "standalone",
          id: "short-video",
          title: "Short video",
          thumb: "./video.jpg",
        },
      ],
    },
    seriesConfig: [
      { slug: "sample-series", title: "Sample Series", thumbnailSrc: "./series.jpg" },
    ],
  };
  const context = vm.createContext({ window });
  vm.runInContext(fs.readFileSync("scripts/catalog-lookup.js", "utf8"), context);
  return window.IMCatalogLookup;
}

test("catalog lookup resolves episodes, progress keys, standalone videos, and series", () => {
  const lookup = loadLookup();
  assert.equal(lookup.episode("sample-series", "episode-1").title, "First episode");
  assert.equal(lookup.progressItem("sample-playlist", "episode-1").thumb, "./episode.jpg");
  assert.equal(lookup.progressItem("standalone", "short-video").title, "Short video");
  assert.equal(lookup.standalone("short-video").thumb, "./video.jpg");
  assert.equal(lookup.series("sample-series").title, "Sample Series");
  assert.equal(lookup.seriesFromUrl("./series/sample-series/").slug, "sample-series");
  assert.equal(lookup.episode("sample-series", "missing"), null);
});
