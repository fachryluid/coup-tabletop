# AGENTS.md — COUP Digital Tabletop

> Agent operating instructions. Read `PLAN.md` first. This document governs **how** AI coding agents work; `PLAN.md` governs **what** the product must do.
>
> Current state: **MVP implementation v1.2**. Begin implementation immediately in small verified phases. Never invent additional house rules.

## 1. Mission and source of truth

Build a browser-based **Coup Digital Tabletop** with private-room multiplayer, semi-automated authoritative rules, built-in toggleable tongkrongan (house) rules, hybrid challenge/block response windows, moderate host tools, hybrid tabletop/modern UI, and addable **Strategic Bot** participants.

Priority when requirements conflict:
1. Explicit latest instruction from the user.
2. Decisions labeled **final** in `PLAN.md`.
3. Other documented requirements and acceptance criteria in `PLAN.md`.
4. Agent's implementation choices, clearly documented as assumptions.

Do not silently override confirmed decisions. Record new confirmed choices in `PLAN.md` and update tests/implementation accordingly. Never invent additional house rules; two rules are now defined in PLAN.md.

## 2. Required workflow

1. **Read project state**: inspect `PLAN.md`, repo structure, Git status, existing code/tests, and latest task. Do not overwrite human work.
2. **Identify scope**: quote the corresponding section(s) of `PLAN.md` in a brief implementation note. Separate final requirements from open questions.
3. **Plan a small vertical slice**: state files/components likely to change, main risks, expected acceptance tests, and a working verification path.
4. **Implement incrementally**: favor small cohesive patches. Keep domain rules independent of UI and socket handlers.
5. **Verify**: run relevant unit, integration, typecheck, lint and build commands where available. Report both passing and failing commands accurately.
6. **Hand off**: describe changed files, functionality, tests run, unresolved questions, and next small action. Never claim tested if not executed.

**Do not block execution on nonessential questions.** Choose safe defaults, document assumptions, and continue building vertical slices. Escalate only decisions that would alter core rules or compromise information privacy. Never invent additional house rules.

## 3. Locked decisions — do not reinterpret

- **2–6 total participants**, including humans and bots; 15-card classic deck (3 each of five characters); 2 starting influence cards and 2 coins per participant.
- **Private room only**, code/link invites, no public matchmaking or mandatory login; host is human. The server draws the first starter, then the previous winner starts if still seated. Session standings count wins per seat.
- **Semi-automated**: players choose actions and social responses; game engine validates/resolves the rules.
- A failed challenge cancels the original action after one challenger influence loss. Declaration costs remain paid.
- Only the target of Steal or Assassinate may challenge the initial action claim.
- **Hybrid Challenge & Block**: configurable server-authoritative timer **default OFF**; when ON, **30 seconds per response window** (both final). OFF waits for eligible passes/valid actions or explicit audited host close; ON automatically passes outstanding eligible players on expiry. Each new window has a fresh server-owned 30-second deadline; timer mode is selected before start and frozen for the match.
- **Moderate host controls** only: lobby/start, end the current match without awarding a win, timer-OFF host-close, pause/resume, coin correction with reason/audit, safe undo of last action when no secret was exposed or subsequent decision taken. No host inspection/editing of secrets or arbitrary influence/turn edits.
- **Hybrid tabletop look + modern responsive UI**. Favor legibility and touch accessibility over heavy animation. Use the five user-supplied illustrations for role card faces. Create original assets for other artwork.
- **Add Computer** before match; room can be played by 1 human + 1–5 bots or mixed human/bot players.
- **Strategic Bot**, not a random-only bot: three difficulty levels (**Easy / Normal / Hard**, configurable individually per bot in lobby, default **Normal**), probabilistic inference from legal observations, bluffing, challenge/block, and adaptive decisions based on public action history. No external paid LLM dependency.
- **House rules** are coded as built-in modules, individually switchable, default OFF, locked during a match. **No house-rule builder UI.** Two built-in rules are specified in PLAN.md §6: `one_time_guess` and `duke_blocks_tax`.

## 4. Architecture and data boundaries

- **Authoritative server** owns deck, hidden cards, phase, coins, turn, validity, timers, lobby membership and winner detection. Never trust client-submitted state.
- A **pure, testable domain engine** should accept validated commands and emit immutable events / state transitions. UI and realtime transport are adapters, not repositories of rule logic.
- Explicit state-machine phases for challenge, block, challenge-against-block, influence loss, exchange, resolution and game over. Use one atomic transition per accepted command with revision/idempotency validation.
- Distinguish **public events**, **per-player private projections**, and **internal-only server secrets**. Neither room snapshots nor logs may leak card identities/deck order.
- Secure reconnect identity with private session tokens bound to room and seat. Code/nickname alone is not authorization to regain a seat. Never issue session secrets in public broadcasts.
- Lobby/bot/room occupancy must be checked atomically to prevent the seventh seat or race-condition duplicates.
- Timer deadlines and pause accounting must be server-owned. Late/duplicate socket requests must be rejected consistently.
- If a storage/realtime stack is not yet confirmed, keep interfaces modular; `PLAN.md` names technology options as recommendations, **not final commitments**.

## 5. Strategic Bot contract

- Strategy code consumes only a sanitized `BotObservation` and a list of currently legal commands. Never pass it full game state.
- Eligible observations: bot's own live cards, public coins/influence and revealed cards, legal actions/responses, public action/challenge/block history, and active rules.
- Forbidden: opponent's unexposed cards, deck order, other players' private options, or hidden shuffle seed.
- Keep separate **policy evaluation**, **belief/history model**, **difficulty configuration**, and **bot turn scheduler**.
- Higher difficulty improves heuristics, not privileged information. Bluff is permitted; overconfident certainty about opponents' cards is not.
- Implement difficulty as an explicit enum `easy | normal | hard` stored per bot seat; UI labels Easy / Normal / Hard. Host can set each bot independently before start; freeze settings on match start. Default to Normal.
- Easy: straightforward choices with occasional defensible bluff; Normal: balanced risk and history; Hard: more complete public-information belief/risk evaluation and target selection. All levels remain strategic and use identical public/own-card observation interfaces.
- Never make Hard omniscient or require Hard to win all games. Use seeded, multi-game statistical tests to demonstrate meaningful policy differences rather than brittle single-game assertions.
- Treat specific numeric thresholds, bluff probabilities, and reaction delays as tuning parameters, not user-approved fixed requirements.
- Use a seedable RNG for deterministic fixtures. Test that equivalent observations + same seed lead to the same action even if hidden game state differs.
- Bot commands go through the exact same validation/state transition path as human commands.
- Bot tasks are cancellable on pause, room/game transitions, changed response windows, and elimination. Implement safe fallback when a previously selected command is no longer legal.
- New built-in house rules require an explicit bot-compatibility check and tests; never silently let bots violate a rule.

## 6. House rules workflow

1. Add a rule definition with stable ID, plain-language description, default OFF and conflict metadata.
2. Extend legal command/state transition logic only at explicit rule hooks.
3. Expose an ON/OFF toggle on room creation, separate from table settings; snapshot the config on match start.
4. Implement targeted tests for OFF (classic baseline), ON, combinations/conflicts and bot compatibility.
5. Verify event logs/projections expose only necessary information.
6. Never create any extra fictional house rule; implement the two confirmed rules in `PLAN.md` §6.

### Confirmed built-in house rules — implement in MVP v1.2

Read `PLAN.md` §6 as the normative specification.

1. `one_time_guess` (default OFF): a player may spend their **one guess for the entire match** naming a living opponent and one of five roles. Only the target submits a Benar/Salah answer. Reject inaccurate answers and let the narrator announce the verified result. Server verifies only living influence. Correct: discard/reveal one matching influence of the target. Incorrect: guesser chooses and loses one living influence. Atomically mark the guess used; guard concurrency/reconnect. Assumed for MVP: this is the guesser's normal turn action, costs 0 coins and has no challenge/block window. Do not expose any other hidden cards. Reset allowance on rematch. Provide legal decision handling for Easy/Normal/Hard bots.
2. `duke_blocks_tax` (default OFF): Tax remains challengeable as usual. With rule ON, other living players may challenge Tax, claim Duke to block, or pass in the same initial window; only the original actor may challenge the block. A successful block prevents +3 coins; a false block incurs standard challenge loss and Tax is cancelled. When OFF, classic Tax cannot be blocked. Integrate with Hybrid timer and simultaneous response handling; bot policy must respond legally.
3. Test the two toggles independently and together; success/failure, repeated guesses, double responses, game-ending influence loss, bot decisions, and privacy boundaries. Where user text doesn't define timing explicitly, use the documented, reversible assumption in PLAN.md rather than presenting it as confirmed.

## 7. Quality gates / definition of done

- Deterministic unit tests for all classic actions and challenge/block resolution; include correct-card proof, bluff failure, card replacement, exchange, elimination and mandatory Coup when >=10 coins.
- Timer default OFF tests, server-owned 30-second deadlines for each ON response window, manual host-close audit, pause/resume deadline accounting, atomic simultaneous responses.
- Permission tests for host-only and player-only actions; safe undo must reject any operation revealing privileged information.
- Reconnect tests, room capacity tests (humans+bots), private/public data projection tests, and multiplayer sync tests.
- Strategic Bot tests: Easy/Normal/Hard legal actions, per-bot lobby configuration/default Normal and locking, solo full-match completion, bluff/challenge availability, history-based adaptation, hidden-information noninterference and cancellation.
- End-to-end checks at mobile and desktop widths for room creation, add/remove bot, play action, challenge/block, loss of influence, and game over.
- Record commands/results in the handoff. No passing tests invented or assumed.

## 8. Implementation phases and agent boundaries

Follow `PLAN.md` phases: (0) specification lock, (1) core engine plus two confirmed house rules, (2) private multiplayer + strategic bots, (3) responsive tabletop UI, (4) house-rule integration polish, (5) QA and deployment. Agent must start implementing MVP now and must not declare a phase complete without its acceptance criteria.

At the end of every coding task report:
- **Implemented:** concise summary of files/behavior.
- **Validated:** exact tests/build commands executed and their outcomes.
- **Open decisions/blockers:** reference `PLAN.md` and do not silently choose.
- **Next action:** one clear, bounded recommendation.

## 9. Decisions still open (see PLAN.md)

- Clarifications for currently assumed details of One-Time Guess (without blocking MVP).
- Official two-player setup/variant details.
- Hybrid disconnect policy is final; follow PLAN.md §18 and do not reopen it.
- Host transfer policy and player removal/replacement after a match starts.
- Strategic bot **level names/count are fixed: Easy / Normal / Hard**; only numeric tuning and response tempo remain open.
- Production target is the Jejakode VPS at coup.jejakode.com. Runtime capacity and remaining visual assets are open.

When new decisions are confirmed, update this list and `PLAN.md` together so they stay consistent.


## 10. Immediate execution directive (v1.2)

- **Start coding without another discovery round.** Read `PLAN.md` §18 first.
- Implement Hybrid Disconnect exactly as specified: offline does not auto-pause; timer ON proceeds unless paused; timer OFF waits for eligible responses or host phase closure; never auto-act/auto-eliminate an offline player.
- Ensure server-side session-based reconnect, private/public state projections, bot decision isolation, and event logging.
- Use Next.js + Socket.IO + TypeScript pure rules engine + Vitest as the initial default when no existing compatible stack is present. In-memory development store is acceptable behind a repository interface.
- Build thin functional MVP end-to-end before polishing assets. The mandatory demo is 1 human + 1 bot reaching a valid game-over state.
- Implement the two supplied house rules now, each with its own toggle, state-machine handling and tests. Do not defer both as an empty registry.
- No default automatic host reassignment, no replacing disconnected humans with bots mid-game, and no exposing private influence data.
- Report exact commands run and tests completed; provide a short next implementation step instead of a questionnaire.
