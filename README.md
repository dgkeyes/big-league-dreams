# big-league-dreams
A baseball game made by Elias Keyes (and Claude)

## Run it

```sh
pnpm install
pnpm dev          # http://localhost:5173, also reachable from an iPad on the same Wi-Fi
pnpm build        # static site in dist/
pnpm run deploy   # build and publish to bigleaguedreams.eliaskeyes.com (needs a Cloudflare token)
```

Play on an iPad in Safari, held sideways. Use Share, then Add to Home Screen, to play it full screen like an app.

## What's in it

Everything is 3D (Three.js), with touch buttons over the view.

- **Make your player:** name, boy or girl, skin, hair style (including a mullet) and color, eyes, jersey number, one of four Portland leagues, and your position.
- **A day in the life:** practice and games take turns every day (Monday practice, Tuesday game, and so on, all year).
  - **Game days:** 9-inning games against another Portland team. You bat leadoff and play the position you picked.
  - **Practice days:** fielding drills, the batting cages, or a 3-inning scrimmage.
- **Batting, in first person:** pick POWER, CONTACT, or BUNT, then tap SWING as the pitch comes in. In T-ball the coach pitches, and after three misses the ball goes on the tee. From Little League up there are balls, strikes, walks, strikeouts, and fouls.
- **Fielding, in first person:** the joystick runs, dragging looks around, FIELD grabs the ball, DIVE lays out for it, and THROW TO 1ST tries to beat the runner. The game slows down a little when the ball is coming to you.
- **Moving up:** after 5 games, or right away if you homer in every at-bat of a game: T-Ball (age 5), Little League (age 8), High School (age 15). A no-baseball day still counts as a game, and SKIP LEVEL jumps up right away.
- **Base running:** after a hit, pick how far to run. Green bases are safe; orange and red ones are a gamble that faster runners win more often.
- **Money and Dick's Sporting Goods:** games and practice pay money. Ride to the store with Dad, follow him to the baseball section, and put bats, gloves, and cleats in the cart. Wander too far and Dad comes looking: then it's no baseball today (which still counts as a game).
- **Home run quest:** hit 5 homers off Rocket Rosie in 15 pitches. Winning earns 10 tokens.

Progress is saved in the browser.

## Testing in a browser without a GPU

In dev, `?manual` stops the real-time loop so `__step(seconds)` can advance the game, `?screen=game` (or `quest`, `cages`, `drills`, `drive`, `store`) opens a screen directly, and `window.__autoSwing = 'contact'` `window.__autoField = true` play for you, and `window.__autoRun = 1` runs one base past the hit (or `-1` to take what the hit gives).
