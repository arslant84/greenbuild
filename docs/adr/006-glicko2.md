# ADR-006: Skill rating with Glicko-2

Status: Proposed (task 38, awaiting the owner's approval)

## Context

Companies will look at a player's skill level, so it must reflect real ability, fall as well as rise, and say how certain it is. XP alone rewards showing up, not skill.

## Decision

- Two independent counters: XP (always grows, rewards regularity) and a skill rating (can fall; the only number companies see).
- The rating is Glicko-2. Each attempt is a match between the player and the challenge version, which has its own rating and rating deviation, calibrated by all players' results.
- Ratings are kept per skill using the weights in `challenge_skills`; the overall rating is a weighted average of skills with enough confidence.
- The worker recalculates after `attempt.finished`. Attempts flagged by anti-cheat are left out until reviewed.
- Companies see the rating with its confidence interval, not a bare number.

## Consequences

- New players reach their level quickly; experienced players do not swing on one failure.
- Challenge versions need rating columns and a calibration period before their results mean much.
- The rating depends on reliable `attempt.finished` events (built in tasks 20a–20b).
