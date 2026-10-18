# Bass Boat crew: shared spec (v1)

Repo: ( GitHub repo Chale27/bassboat, published with GitHub Pages from main /).
Owner GitHub login: Chale27. Timezone: America/Chicago.

## Layout
- index.html, run/index.html, assets/site/  -> dashboard (static, reads crew.json with fetch, no build step)
- crew.json                                -> the single shared data file (schema below)
- style.md                                 -> Chale's taste notes, appended from "notes:" tickets
- sources.json                             -> cache of checked claims: [{id, claim, url, title, publisher, checkedAt, quote}]
- format-bible.md                          -> copy of the format bible rules
- week/<YYYY-WW>/<video-id>/storyboard.json -> one per video (schema below)
- week/<YYYY-WW>/<video-id>/final.mp4      -> finished video (Spinner output); preview.jpg poster
- render/                                  -> HyperFrames templates + scripts (Spinner)
- tasks/<crew>/SKILL.md                    -> scheduled-task prompts for the 6 crew members
- mac/                                     -> launchd plist + install script for Chale's Mac (~/BassBoat is the clone)

## Video ids and statuses
video id: "w<YYYY-WW>-<n>-<slug>", e.g. "w2026-43-1-deep-water-bass".
status flow: idea -> scripted -> awaiting_script -> approved | noted -> rendered -> awaiting_final -> scheduled -> posted | rejected | retired

## storyboard.json (one per video; Jig writes, Spinner reads)
{
  "id": "w2026-43-1-deep-water-bass",
  "format": "what-happens-if" | "ten-facts",
  "title": "What Happens When You Reel Up a Bass From 30 Feet?",
  "hook": "If you reel a bass up from 30 feet down...",
  "style": "clay" | "blueprint" | "isometric",
  "script": "full narration text, 75-90 words",
  "lines": [                       // narration split into caption-sized lines, in order
    {"text": "If you reel a bass", "shot": 1}, ...
  ],
  "shots": [                       // 4-7 shots for what-happens-if; 12 for ten-facts (title + 10 facts + end)
    {"n": 1, "scene": "dock" | "boat" | "underwater" | "cutaway" | "studio",
     "subject": "bass" | "lure:crankbait" | "angler" | "boat" | "...",
     "action": "plain-words description of what moves",
     "camera": "push-in" | "orbit" | "pull-out" | "static" | "pan",
     "counter": null | 1..10,       // ten-facts only
     "est_seconds": 4.5}
  ],
  "ending": "payoff" | "question",
  "question": null | "Which one did you already know?",
  "claims": [{"text": "...", "source_id": "src-..."}],   // every factual sentence, cited from sources.json
  "voice": {"provider": "elevenlabs", "voice": null},
  "log": [{"step": "jig", "minutes": 0, "cost_usd": 0, "at": "ISO"}]
}

## crew.json
{
  "updatedAt": "ISO",
  "week": "2026-43",
  "settings": {"cadence_per_week": 7, "post_time": "18:00", "tz": "America/Chicago", "house_styles": [], "voice": null,
               "targets": {"hold3s": 0.60, "avg_watch": 0.70, "saves_per_view": 0.05, "shares_saves_per_1k": 10,
                           "my_minutes_per_video": 4, "usd_per_video": 1.0, "first_pass_approval": 0.70}},
  "crew": {"<crew id>": {"name": "Sonar", "role": "Scout", "schedule": "Sunday 6:00 PM", "state": "ok|needs_you|running|idle",
           "lastRunAt": "ISO|null", "lastSummary": "", "log": [{"at": "ISO", "note": ""}]}},
          crew ids: scale, sonar, jig, spinner, cast, anchor
  "ideas": [{"id", "title", "angle", "format", "score", "sources": ["src-..."], "status": "idea|picked|dropped"}],
  "videos": [{"id", "week", "title", "format", "style", "status", "storyboard": "week/.../storyboard.json",
              "final": null|"week/.../final.mp4", "poster": null|"...jpg",
              "approval": {"script": null|"approved|noted", "final": null|"approved|noted", "notes": [""], "reason": null},
              "post": {"tiktok": null|{"url","postedAt","mode":"draft|public"}, "instagram": null|{"url","postedAt","trial": true}},
              "stats": null|{"views","hold3s","avg_watch","saves","shares","likes","comments","curve": [[sec, pct], ...]},
              "cost": {"minutes_crew": 0, "render_seconds": 0, "elevenlabs_chars": 0, "usd": 0, "my_minutes": 0}}],
  "formats": [{"id": "what-happens-if", "status": "active|testing|retired", "misses_in_row": 0}],
  "scorecard": {"baseline": null|{...same keys as weekly...}, "weeks": [{"week", "my_minutes_per_video", "usd_per_video", "videos_shipped", "first_pass_approval", "hold3s", "avg_watch", "saves_per_view", "shares_saves_per_1k"}]},
  "tickets": {"<task-or-video>": {"status": "waiting|started|done|failed", "issue": 12, "at": "ISO", "note": ""}}
}

## Tickets (GitHub issues on Chale27/bassboat, only opened by Chale27 are honored; Anchor polls every 15 min)
- "run: <crew id>"           -> start that crew member now
- "approve: <video id>"      -> script approved (status approved)
- "notes: <video id>"        -> body = notes; appended to style.md; status noted; Jig rewrites
- "final: <video id>"        -> final approved (status scheduled)
- "reject: <video id>"       -> body = reason; status rejected
