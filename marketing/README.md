# Marketing & Publicity Guide

This folder holds everything publicity-related for Improving Muslim: finished social assets, the templates and scripts that generate them, and this guide. It documents what has been done so far and how to continue, so anyone joining can pick up without re-deriving decisions.

Status snapshot as of **21 July 2026**. Update this file whenever campaigns, outreach status, or assets change — treat it like `DEV_README.md` for publicity.

## The pitch (use this framing everywhere)

Improving Muslim is a free platform for watching Islamic lectures **without the noise** — no ads, no comments, no endless scrolling, no unrelated recommendations. Learners browse by topic, follow series, track progress, build a daily streak, and take timestamped notes. 100+ lectures live at [improvingmuslim.com](https://improvingmuslim.com).

Tagline: **"Islamic lectures. Without the noise."**

## Brand system

All assets share the website's design language. Reuse these values — do not invent new ones:

| Element | Value |
|---|---|
| Background cream | `#f2ece0` (page) / `#fffdf8` (cards) |
| Ink (dark text) | `#18201b` |
| Accent teal | `#176b5b` (wordmark dark variant `#0f4f43`) |
| Gold (URLs, kickers) | `#c89b3c` |
| Muted text | `#4d5c55` / `#7a857e` |
| Heading font | Inria Serif 700 (Google Fonts) |
| Body font | Inter (Google Fonts) |
| Logo | Inline SVG — copy it from any template in this folder or `public/social-preview-template.html` |
| Decoration | Soft circular "blobs" in muted sage/sand tones |

Product imagery (thumbnails, speaker photos) comes straight from the repo: `assets/thumbnail/**` and `assets/speaker/*`. Showing the real product is deliberate — it converts better and sets honest expectations.

## Asset inventory

| Asset | What it is |
|---|---|
| `instagram-post-1080x1350.png` | Main launch/ad post (4:5 feed) — headline + phone mockup of the app |
| `instagram-post-template.html` | Editable source for the above |
| `ig-speaker-{mufti-menk,omar-suleiman,ali-hammuda,navaid-aziz}.png` | Speaker spotlight posts (4:5 feed) |
| `ig-speaker-template.html` | Speaker spotlight source with `{{TOKENS}}` — one template, any speaker |
| `ig-story-navaid-aziz.png` | Release story (9:16) for the Navaid Aziz tag-and-reshare arrangement |
| `ig-story-speaker-template.html` | Release story source with `{{TOKENS}}` — reuse for every speaker release story |
| `render-instagram-posts.cjs` | Regenerates **all** post PNGs from the templates (see below) |
| `instagram/first-post/` | 5-slide intro carousel (SVG sources + PNGs + generator) |
| `instagram/youtube-comparison/` | "You came for one lecture" comparison post (4:5 feed) — left panel mocks a YouTube-style feed (parody clickbait/gaming/Shorts, no real channels or IP), right panel shows real lecture cards. `distractions-collage.png` holds the AI-generated distraction imagery; the deliberately immodest crop from it is unused. Rendered by `render-instagram-posts.cjs`. |
| `ads/` | Display banner set (leaderboard 728×90, rectangle 300×250, IG feed 1080×1080, landscape 1280×720, story 1080×1920) as SVG + generator |

### Regenerating the Instagram posts

```powershell
npm install                          # once, repo root
npx playwright install chromium      # once
node marketing/render-instagram-posts.cjs
```

To add a new speaker spotlight: copy an entry in the `speakers` array inside `render-instagram-posts.cjs`, point it at a photo in `assets/speaker/` and thumbnails in `assets/thumbnail/`, and re-run. Speaker photos and series thumbnails exist for every speaker on the platform.

## What has been done (chronological)

1. **Intro carousel** (`instagram/first-post/`) and **display banner set** (`ads/`) created.
2. **Main ad post** created and posted to the official Instagram account, then **boosted as a paid ad** targeting Singapore, UK, United States, France, and Spain (English-speaking Muslim audiences).
3. **Three speaker spotlight posts** created (Mufti Menk, Omar Suleiman, Ali Hammuda) to fill the account grid so paid-traffic visitors don't land on a one-post account. Intended cadence: post 1–2 days apart, not all at once.
4. **Speaker/partner outreach via Instagram DM** began — see the table below.
5. **YouTube-comparison post** (`instagram/youtube-comparison/`) created — planned as the account's **5th post**, with a boost intended after posting. Left panel mocks a YouTube feed (parody clickbait/gaming/Shorts — no real channels or third-party IP, deliberately, so Meta doesn't reject the boost); right panel mirrors the real website cards with episode-count/duration badges. Note: the Change of Heart badge says **16 episodes** because that's the site's registry total (`data/series-registry.js`), even though the older advertised-counts list below says 20 — reconcile that list if the registry is right.
6. **First direct speaker permission received:** Navaid Aziz granted written permission to place his content on Improving Muslim and invited a conversation about collaboration. The immediate priority remains publishing more content and bringing more speakers on board; any partnership can be explored later, with no expectation placed on him.
7. **First paid speaker-promotion proposal sent:** Navaid Aziz was offered **USD $75–$100** for a short Instagram Reel introducing Improving Muslim, with permission for Improving Muslim to repost the same video organically on its own YouTube Shorts and TikTok accounts with credit. Paid-ad usage was not requested or included.
8. **Navaid Aziz countered with a free arrangement, accepted:** instead of the paid Reel, Improving Muslim tags him (**@navaid_aziz**) in an Instagram story whenever his content goes live, and he reshares it — free of charge. This makes every release of his content a distribution moment; publish his episodes in regular batches rather than one big drop. First promoted releases: **40 Hadith of Imam Nawawi** and **The Four Imams: Their Lives and Fiqh Principles**. The release-story asset is `ig-story-navaid-aziz.png` (from `ig-story-speaker-template.html`, rendered by `render-instagram-posts.cjs`).

### Outreach status

| Contact | Status | Angle used |
|---|---|---|
| Hisham Abu Yusuf | DM sent | His lecture "Why Am I Here?" is featured; feedback + consent + collaboration |
| Ali Dawah | DM sent | General platform pitch; feedback + collaboration |
| OnePath Network | Drafted, not yet sent | **Forward-looking permission** — no OnePath content is on the platform yet; asking before featuring any |
| Navaid Aziz | Permission granted; nine additional playlists supplied; story-tag/reshare arrangement in place (he declined the paid Reel in favour of resharing for free) | Tag @navaid_aziz in a story on every release of his content; he reshares. First promoted releases: 40 Hadith of Imam Nawawi + The Four Imams |
| Majed Mahmoud | Drafted, not yet sent | His Prophet-stories lectures + du'aa lecture are featured; consent + feedback |

**Outreach principles — keep these:**

- Consent-first. Every message tells the speaker their content is on the platform and asks if they're comfortable with it, *before* asking for anything else. For organizations whose content is **not** yet hosted (like OnePath), ask permission before featuring, never after.
- Tone: personal, specific (name their actual content on the platform), no mass-blast feel. Not "please promote us" — feedback and collaboration.
- **Save written permission.** Any reply that says yes is effectively a consent record — screenshot it and keep it somewhere durable. It will matter as the platform grows.
- Be ready for "why is only part of my series up?" — answer: series are uploaded progressively; the roadmap page shows targets.

### Early-user outreach via Instagram

This is separate from speaker and partner outreach. The aim is to invite ordinary Muslims who already show an interest in Islamic lectures — for example, people who engage with a speaker's Instagram posts — to try the website and give honest feedback. Do not ask them to promote, share, or publicly support the project.

Copy, paste, and personalize this message where appropriate:

> Assalamu alaikum, sorry for the random message! I came across your profile through an Islamic lecture post and thought this might interest you.
>
> I'm building Improving Muslim, a free website for watching Islamic lectures without ads, comments, endless scrolling, or unrelated recommendations.
>
> I'm looking for a few early users to try it and give honest feedback. There's no need to share or promote anything — I'd just appreciate hearing whether you find it useful and what could be improved.
>
> improvingmuslim.com
>
> No worries at all if not. JazakAllahu khayran!

When it feels natural, make the opening more specific: `I came across your profile through a Mufti Menk lecture post...` Contact genuine-looking accounts in small batches, avoid pretending to know the person, and treat no response as a no. Send at most one polite follow-up.

If someone agrees to test the website, ask these three questions:

1. Was it easy to find something you wanted to watch?
2. Did anything feel confusing, broken, or unnecessary?
3. What would make you return to the website?

### Small content-creator outreach via Instagram

This is for Islamic content creators who have an established audience but are still small enough for a friendly, general collaboration message. The invitation is deliberately open: they may help with a short promotional video, offer feedback as a user and creator, or suggest another form of collaboration they are comfortable with. Do not imply that they have endorsed the platform before they explicitly agree.

Use this as the base message, personalizing the opening when there is something genuine and specific to mention:

> Assalamu alaikum! I came across your Islamic content and really appreciated your work.
>
> I’m a developer building Improving Muslim—a free platform for watching Islamic lectures without ads, comments, endless scrolling, or unrelated recommendations.
>
> I’d love for you to check it out: improvingmuslim.com
>
> If you like the project and feel it aligns with your values, I’d be interested in working together—perhaps on a short promotional video, or simply hearing your honest feedback as a user and content creator.
>
> No pressure at all. If you’re interested, please feel free to reply and we can discuss whatever you’d be comfortable with.
>
> JazakAllahu khayran!

Contact genuine, relevant creators in small batches and keep a record of messages and replies. If someone is interested in producing promotional content, agree on the format, wording, usage rights, posting account, timing, and whether the work is paid before production begins. Send at most one polite follow-up if there is no response.

#### Creator outreach log

| Date | Contact | Audience snapshot | Status | Notes |
|---|---|---|---|---|
| 20 July 2026 | Creator 01 (handle not recorded) | 53 posts; 8,142 followers; 182 following | Initial DM sent | First use of the general small-creator collaboration message |

### Caption bank (reuse/adapt)

YouTube-comparison post caption: *"You open YouTube for one lecture. An hour later you've watched everything except that lecture. Improving Muslim is a free website with one job: Islamic lectures, and nothing pulling you away from them. No ads, no comments, no algorithm. Browse by topic, follow series, keep your progress. improvingmuslim.com — link in bio."*

Main ad post — caption as actually posted (and boosted):

> Tired of opening YouTube for one lecture and closing it an hour later, having watched everything except that lecture?
>
> We built Improving Muslim for exactly that problem — a free platform with 100+ Islamic lectures and series in one quiet place:
>
> 🕌 Browse by topic — Seerah, Quran, Prayer, Purification & more
> 📿 Follow full series from Mufti Menk, Omar Suleiman, Ali Hammuda & others
> ✍️ Take timestamped notes while you watch
> 🔥 Build a daily learning streak
>
> No ads. No comments. No algorithm pulling you somewhere else.
>
> Start watching free — link in bio 👉 improvingmuslim.com

Speaker post captions lead with the speaker's theme, not the platform: e.g. Omar Suleiman — *"'Why me?' — the question every one of us has asked in hardship."* Two to three sentences, then `improvingmuslim.com — link in bio.`

## Content guidelines & known cautions

- **Episode counts on ads are full-series counts** (Life of Muhammad 30, Why Me? 30, Angels in Your Presence 31, Change of Heart 20, Enjoy Your Prayer 21) on the commitment that the remaining episodes are uploaded promptly. The currently-watchable counts live in `data/series-registry.js` (`availableCount`). **Before running new paid traffic, make sure the advertised series are fully uploaded** — paid visitors hitting "Uploading soon" is wasted spend.
- The Omar Suleiman post's source-thumbnail quirks have been cleaned up (July 2026): the "Trailer" text was inpainted out of `assets/thumbnail/heart-softeners/whyme.jpg` (this also updates the website card), and the Angels in Your Presence card now uses the clean episode-01 thumbnail instead of the "TRAILER"/Yaqeen-logo one. The small "Q" watermark in the whyme.jpg top-right corner was deliberately left — it's source attribution.
- Ads and posts name real speakers whose consent is still being gathered. That is factually accurate (their content is on the platform) — but if a speaker declines or asks for removal, pull the related posts/ads the same day, no argument.
- Always link `improvingmuslim.com`. Put it in the account bio (organic captions aren't clickable); use the real destination URL on boosted posts.
- Instagram bio, boosts: choose interests like Islam, Quran, and the featured speakers' audiences; ages ~18–40; small daily budget over a week beats one large burst.

## Spending log

Every dollar spent on publicity goes here, so total spend is always known at a glance. Log new boosts/ads as soon as they run; add results (reach, link clicks, cost per click) when the campaign finishes.

| Date | What | Amount | Results |
|---|---|---|---|
| July 2026 | Boost of the main ad post ("Tired of opening YouTube for one lecture…" — `instagram-post-1080x1350.png`), targeting Singapore, UK, US, France, Spain | $20.00 | Not yet recorded — pull reach/clicks from Meta Ads Manager and note here |

**Total spent to date: $20.00**

## Where to pick up

Ideas queued, in rough priority order:

1. **Post the YouTube-comparison post** (5th post) with its caption from the caption bank, then boost it — but only after the featured series (Why Me?, Change of Heart) are fully uploaded, per the paid-traffic rule below.
2. **Run the first Navaid Aziz release story:** once the 40 Hadith and Four Imams batches are live, post `ig-story-navaid-aziz.png` as a story, tag **@navaid_aziz** with the mention sticker (the space between the cards and the footer is left calm for it), add a link sticker to improvingmuslim.com, and DM him that it's up so he can reshare. Repeat with a fresh render (new `stories` entry in `render-instagram-posts.cjs`) for every future batch of his content. Also post the Navaid speaker spotlight (`ig-speaker-navaid-aziz.png`) to the grid on the staggered cadence. Send the remaining drafted DMs to OnePath and Majed Mahmoud and log any replies above.
3. Post the speaker spotlights on the planned staggered cadence.
4. More speaker spotlights from the template (Belal Assaad, Abu Taymiyyah, Abu Bakr Zoud, Majed Mahmoud — assets all exist).
5. A features post (My Notes, streaks, progress sync) — differentiators no re-upload channel has.
6. Story/Reel variants (1080×1920) — the `ads/story-1080x1920.svg` banner is a starting point.
7. Track boost results (reach, link clicks, cost per click) and note what worked here.
