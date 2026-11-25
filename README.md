# The Lantern Below

A small metroidvania made as a birthday gift. Twenty-two lanterns are hidden through four
zones; lighting each one reveals a private letter from a friend.

* **Writers** (the 22 friends) each get a unique link. They can write and edit only their own letter.
* **The birthday person** gets one passcode. Only that passcode opens the game and the letters.
* **You (organiser)** get a backstage page. You can see who has written and how many words. You can **not** read the letters there, by design.

## Placeholders to fill in later

Search the project for `PLACEHOLDER`. Everything is in one file: [`lib/site.ts`](lib/site.ts).

| What | Where |
|---|---|
| Birthday person's name | `heroName` in `lib/site.ts` |
| Birthday date label / age (finale screen) | `birthdayLabel`, `turningAge` |
| 2–3 quirks (shown as lines when resting at benches) | `quirks` |
| Final boss name + line | `finalBossName`, `finalBossLine` |
| **Face photo** | drop a square-ish PNG at `public/hero/face.png`. It is cut into a circle and set into the character's hood automatically. Until then, the face is an empty placeholder disc. |

For the photo: a head-and-shoulders crop, face centred, at least 256×256, works best.

## Run locally

```powershell
npm install
npm run dev
```

Open http://localhost:3000. With no environment set, dev defaults are used:
passcode `lantern`, organiser code `organiser`. Data is stored in `.data/db.json`.

* `/` birthday person's door
* `/admin` organiser (create invites, copy links, close letters, preview the game)
* `/write/<token>` a writer's page
* `/play` the game (needs the passcode, or the organiser session for a preview with placeholder letters)

`npm run check:level` verifies every jump in the world is possible with the abilities the player has at that point.

## Deploy on Vercel

1. Push this folder to a GitHub repo and import it at vercel.com/new.
2. In the Vercel project: **Storage → Create → Upstash Redis** (Marketplace, free tier). Connect it to the project. This injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
3. **Settings → Environment Variables**, add (Production):

   | Name | Value |
   |---|---|
   | `SESSION_SECRET` | long random string (`openssl rand -base64 32`) |
   | `LETTER_SECRET` | a different long random string. This encrypts letters. **Back it up. If it's lost, letters are unreadable.** |
   | `HERO_CODE` | the passcode you'll give the birthday person |
   | `ADMIN_CODE` | your organiser code |
   | `UNLOCK_AT` | optional: e.g. `2027-01-15T00:00:00+05:00`. Before this moment the passcode is refused. |

4. Deploy. Then visit `/admin`, enter your code, paste 22 names, and send each friend their link.
5. A day before the birthday, press **Close letters** on `/admin`.
6. On the day, give them the site URL and the passcode.

Production refuses to start without these secrets, so it can't accidentally run with the dev defaults.

## How privacy is enforced

* Letters live in the database, **never in the client bundle**. The game fetches one letter at a time from `/api/letters/<n>`, and only with a valid birthday-person session cookie.
* Letters are encrypted at rest (AES-256-GCM, key from `LETTER_SECRET`).
* Writer tokens are stored as HMAC hashes for lookup. A writer's token can only ever read/write the letter belonging to that writer.
* The organiser API returns status and word count only. The preview game shows placeholder text, not real letters.
* Rate limits on passcode, organiser code and writer endpoints. Session cookies are signed, HttpOnly, SameSite, Secure in production.
* `Referrer-Policy: no-referrer` so writer links don't leak, and `noindex` headers so search engines skip everything.

Honest limit: anyone with access to your Vercel project **and** the `LETTER_SECRET` could decrypt letters. That's you.

## Controls

← → move · Space jump (hold for higher) · J strike · K dash · E rest/read · L letters · Esc pause · M sound
Abilities are found at altars: dash (zone 2), wall-cling (zone 3), double jump (zone 4).
There is a Gentle mode on the title screen, and an "I just want to read the letters" option in the pause menu.

## The world

Four zones, 22 lanterns. Each lantern opens by a different kind of milestone: reaching it, defeating a number of creatures,
gathering wisps, reading tablets, a timed rune run, hidden rooms, and three bosses.
