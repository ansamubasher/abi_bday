# Hollow Knight: Abi Birthday Edition

A short, fan-made metroidvania, made as a birthday gift (not affiliated with Team Cherry). Twenty-two lanterns are hidden
through four zones; lighting each one reveals a private letter from a friend. A first run takes a few minutes of play,
plus however long the letters take to read.

* **Friends** (up to 22) all get the same one link. They type their name and letter and press send. They can't read anyone's letter, and the link can't open the game.
* **The birthday person** gets one passcode. Only that passcode opens the game and the letters.
* **You (organiser)** get a backstage page with that share link, who has sent a letter and how many words. You can **not** read the letters there, by design.

## Placeholders to fill in later

Search the project for `PLACEHOLDER`. Everything is in one file: [`lib/site.ts`](lib/site.ts).

| What | Where |
|---|---|
| Birthday person's name | `heroName` in `lib/site.ts` (set: Abi) |
| Birthday date label / age (finale screen) | `birthdayLabel`, `turningAge` |
| 2–3 quirks (shown as lines when resting at benches) | `quirks` |
| Final boss name + line | `finalBossName`, `finalBossLine` |
| **Face photo** | `public/hero/face.png` (set). It is set into a round window in the character's horned mask, and shown on the title screens. Replace the file to change it. |

For the photo: a head-and-shoulders crop, face centred, at least 256×256, works best.

## Run locally

```powershell
npm install
npm run dev
```

Open http://localhost:3000. With no environment set, dev defaults are used:
passcode `lantern`, organiser code `organiser`. Data is stored in `.data/db.json`.

* `/` birthday person's door
* `/admin` organiser (copy the share link, see who has sent, remove someone, close letters, preview the game)
* `/join/<code>` the one link friends use to send a letter
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

4. Deploy. Then visit `/admin`, enter your code, copy the share link and send it to your friends.
5. A day before the birthday, press **Close letters** on `/admin`.
6. On the day, give them the site URL and the passcode.

Production refuses to start without these secrets, so it can't accidentally run with the dev defaults.

## How privacy is enforced

* Letters live in the database, **never in the client bundle**. The game fetches one letter at a time from `/api/letters/<n>`, and only with a valid birthday-person session cookie.
* Letters are encrypted at rest (AES-256-GCM, key from `LETTER_SECRET`).
* Sending a letter never gives access to anything else: no login, no game, no way to read letters back. Letters can't be edited after sending; if someone needs a change, press **Remove** on `/admin` and they send a new one.
* The organiser API returns status and word count only. The preview game shows placeholder text, not real letters.
* Rate limits on passcode, organiser code and writer endpoints. Session cookies are signed, HttpOnly, SameSite, Secure in production.
* `Referrer-Policy: no-referrer` so writer links don't leak, and `noindex` headers so search engines skip everything.

Honest limit: anyone with access to your Vercel project **and** the `LETTER_SECRET` could decrypt letters. That's you.

## Controls

← → move · Space jump (hold for higher) · J strike · K dash · E rest/read · L letters · Esc pause · M sound
Abilities are found at altars: dash (zone 2), wall-cling (zone 3), double jump (zone 4).
There is a Gentle mode on the title screen, and an "I just want to read the letters" option in the pause menu.

## Little extras (all optional, none gate a letter)

* **Grubs**: six, hidden in jars. Press E to free one. Two and four of them each add a flame; all six trigger a small celebration.
* **The delicate flower** (Rootworks): pick it up, carry it to the vase past the rune room without being hit. It shatters if you are, and returns to where it started. Reward: one more flame.
* **Millibelle's Bank**: deposit wisps. After enough deposits the bank closes, and she turns up later in the Drowned Archive. Banked wisps still count toward lantern milestones.
* **Cornifer's map**: a folded, unfinished map near the start. "Hm hm hm..."
* **Quirrel by the blue lake**: the quiet nook past the High Secret in the Crown Below.

## The world

Four zones, 22 lanterns. Each lantern opens by a different kind of milestone: reaching it, defeating a number of creatures,
gathering wisps, reading tablets, a timed rune run, hidden rooms, and three bosses.
