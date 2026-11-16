# big-league-dreams
A baseball game made by Elias Keyes (and Claude)

## Run it

```sh
pnpm install
pnpm dev      # http://localhost:5173, also reachable from an iPad on the same Wi-Fi
pnpm build    # static site in dist/
```

Play on an iPad in Safari, held sideways. Use Share, then Add to Home Screen, to play it full screen like an app.

## What's in it

- **Make your player:** boy or girl, and one of four Portland leagues.
- **Play a game:** full games against another Portland team. You bat leadoff and play shortstop.
  - **Batting:** pick CONTACT (easier to hit), POWER (hits it far, harder to time), or BUNT (Little League and up). T-ball is off a tee; after that, real pitches with balls, strikes, walks, strikeouts, and fouls.
  - **Fielding:** when the ball is hit to you, tap GRAB IT or DIVE, then tap in the green to throw to first.
- **Moving up:** every 20 games you move up a level: T-Ball (age 5), Little League (age 8), High School (age 15).
- **Money and the sports shop:** games pay money for wins, hits, homers, and outs you make. Spend it at Rose City Sports on bats, gloves, and cleats that boost your skills.
- **Home run quest:** hit 5 homers off Rocket Rosie in 15 pitches. Winning earns 10 tokens.

Progress (money, tokens, skills, gear, games played) is saved in the browser. Add `?canvas` to the URL to force the 2D renderer on browsers without a GPU.
