import Groq from "groq-sdk";
import { logger } from "../lib/logger.js";

let groqClient: Groq | null = null;

function getGroq(): Groq | null {
  if (!process.env.GROQ_API_KEY) return null;
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

export interface BotContext {
  botName: string;
  isWolf: boolean;
  round: number;
  alivePlayers: string[];
  recentMessages: Array<{ playerName: string; text: string }>;
  gameMode: string;
  wolfCount?: number;
}

// ─── The Wolf game rules (for prompts) ───────────────────────────────────────
//
// Each round ONE player is secretly "the wolf."
// Everyone votes RED or BLUE. Resolution order:
//   1. If blue > 70%: OVERPOPULATION — everyone dies. Game over.
//   2. If wolf voted majority: wolf's BITE activates → minority voters all die.
//   3. Standard: if red ≥ blue → blue voters die. If blue 51–70% → peaceful, no deaths.
//
// Clear conditions (end the game):
//   - BLOODBATH: survivors ≤ threshold (~30% of start). Survivors go free.
//   - BLIND MARTYR: wolf voted blue AND blue ≤ 30% → wolf + blue voters die, rest go free.
//
// Innocent win condition: survive until a clear condition is met.
// Wolf win condition: activate the bite (vote with the majority) and kill the minority.
//
// Key insight: this is NOT "find the wolf". Players cannot identify the wolf from voting alone.
// The game is about VOTE COORDINATION. Red is always safe for you (you survive).
// Blue is risky: only safe if 51–70% go blue. Above 70% = everyone dies.
// The wolf will always try to be in the majority — so coordinating a clean majority is dangerous.

const GAME_RULES = `
THE WOLF game rules — read carefully, these determine your strategy:

Each round, one random player is secretly the wolf. No one knows who.

VOTE RESOLUTION (in strict order):
1. OVERPOPULATION: if more than 70% vote Blue → everyone alive dies. Total wipeout.
2. WOLF BITE: if the wolf voted for the majority color → all minority voters die.
3. STANDARD: if Red ≥ Blue → Blue voters die. If Blue is 51–70% → peaceful round, no deaths.

GAME ENDS when:
- BLOODBATH: survivors drop to ≤ the bloodbath threshold (good, survivors escape).
- BLIND MARTYR: wolf voted Blue AND total Blue ≤ 30% → those players die, rest escape.

WHAT THIS MEANS:
- Red is always the safe vote for you — you survive red regardless.
- Blue is a coordination bet. It only saves everyone if 51–70% choose it. Above 70% = everyone dies.
- You cannot identify the wolf by looking at people. The wolf is random each round.
- The wolf will always vote with whichever side is winning so their bite activates.
- Chat is for COORDINATING THE VOTE — not for hunting anyone.
`;

export async function generateBotMessage(ctx: BotContext): Promise<string> {
  const groq = getGroq();
  if (!groq) return getOfflineBotMessage(ctx);

  const recentChatText = ctx.recentMessages.slice(-8).map(m => `${m.playerName}: ${m.text}`).join("\n");
  const noChat = !recentChatText;

  const systemPrompt = ctx.isWolf
    ? `${GAME_RULES}

You are ${ctx.botName}. You are secretly the wolf this round.

YOUR GOAL: activate your bite by voting with the majority. You win when the minority dies.

Your chat strategy:
- Push people toward whichever color will become the majority (usually Red is safer to push since it avoids overpopulation).
- Sound like a normal player coordinating strategy. Talk about vote math, risk of overpopulation, survival odds.
- Don't hint you're the wolf. No dramatic villain talk.
- Reference what others said if there's chat. Agree with sensible points to look cooperative.
- One or two sentences only. No questions. Statements and reads.
- Mix sentence case with occasional emphasis (e.g. "that's a BLUE trap").`
    : `${GAME_RULES}

You are ${ctx.botName}. You are a regular player trying to survive.

YOUR GOAL: survive long enough for a clear condition (bloodbath or blind martyr) to trigger. Red is safer. Blue only works as a coordinated bet.

Your chat strategy:
- Talk about vote coordination and survival math — not about "who the wolf is" (you can't know).
- Warn about overpopulation if blue is trending high. Push red if things look chaotic.
- Point out if blue coordination seems risky this round.
- Reference what others said if there's chat. Agree or push back based on the vote math.
- One or two sentences only. No questions. Statements.
- Mix sentence case with occasional emphasis.`;

  const userPrompt = `Round ${ctx.round}. Players alive: ${ctx.alivePlayers.join(", ")}.

${noChat ? "Discussion just opened. Set the tone — talk about vote strategy." : `Recent chat:\n${recentChatText}`}

Write your single message as ${ctx.botName}. Talk about vote strategy and survival math, not about identifying anyone.`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 90,
      temperature: 0.82,
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) return getOfflineBotMessage(ctx);
    return text.slice(0, 220);
  } catch (err) {
    logger.warn({ err }, "Groq API error, using offline bot message");
    return getOfflineBotMessage(ctx);
  }
}

export async function generateBotVote(ctx: BotContext & {
  redCount: number;
  blueCount: number;
  aliveCount: number;
}): Promise<"red" | "blue"> {
  const groq = getGroq();
  if (!groq) return getOfflineBotVote(ctx);

  const redPct = ctx.aliveCount > 0 ? Math.round((ctx.redCount / ctx.aliveCount) * 100) : 50;
  const bluePct = 100 - redPct;
  const remainingVoters = ctx.aliveCount - ctx.redCount - ctx.blueCount;
  const chatSummary = ctx.recentMessages.slice(-10).map(m => `${m.playerName}: ${m.text}`).join("\n") || "(no chat)";

  const systemPrompt = ctx.isWolf
    ? `${GAME_RULES}

You are ${ctx.botName}, the wolf. Your ONLY goal: vote with whichever color will be the MAJORITY when all votes are in.

Current votes: RED ${ctx.redCount} | BLUE ${ctx.blueCount} | ${remainingVoters} players haven't voted yet.
Projected: RED ${redPct}% | BLUE ${bluePct}%

Rules for your decision:
- Vote for whichever color is currently leading (or likely to lead after remaining votes).
- If it's close, vote Red — it's the natural default and avoids any overpopulation risk.
- NEVER vote Blue if Blue is already above 60% (risks overpopulation which kills you too).
- The bite activates when you're with the majority. Simple.

Discussion so far:
${chatSummary}

Respond with ONLY the single word "red" or "blue".`
    : `${GAME_RULES}

You are ${ctx.botName}, a regular player. Your goal: survive.

Current votes: RED ${ctx.redCount} | BLUE ${ctx.blueCount} | ${remainingVoters} players haven't voted yet.
Projected: RED ${redPct}% | BLUE ${bluePct}%

Decision rules (apply in order):
1. If Blue is already at or above 60%: vote RED immediately. Blue is heading toward overpopulation and everyone dies.
2. If Red is clearly winning (>55%): vote RED too — join the safe majority. Blue voters will die but you won't.
3. If it's genuinely close (45–55% each): vote RED by default. Red is always safe for you. Blue is a gamble.
4. Only vote Blue if there's a clear coordinated signal in the chat that a controlled blue majority (55–65%) is achievable AND current blue is not yet near 70%.

Remember: overpopulation (blue > 70%) kills everyone including you. Red is survival unless you're coordinating a tight blue majority.

Discussion so far:
${chatSummary}

Respond with ONLY the single word "red" or "blue".`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Cast your vote now." },
      ],
      max_tokens: 5,
      temperature: 0.3,
    });
    const text = completion.choices[0]?.message?.content?.trim().toLowerCase() ?? "";
    if (text.includes("blue")) return "blue";
    if (text.includes("red")) return "red";
    return getOfflineBotVote(ctx);
  } catch {
    return getOfflineBotVote(ctx);
  }
}

function getOfflineBotMessage(ctx: BotContext): string {
  const wolfMessages = [
    "Red is the only clean play here. Blue coordination with this many people is impossible.",
    "We've seen blue blow up twice. Stick red this round.",
    "The math is simple: red keeps you alive. Stop gambling on blue.",
    "Anyone pushing blue with this group size is setting us all up.",
    "Red. Every time. At least we control the outcome.",
  ];
  const innocentMessages = [
    "Red is the safe vote. Blue only works if we're disciplined, and we're not.",
    "If blue spikes past 70 we all die. Play it safe.",
    "I'm going red. Coordinating blue in a group this size is a trap.",
    "The wolf wants chaos. Don't give it to them. Red.",
    "Blue only works as a tight band. We're nowhere near that. Red.",
    "Anyone pushing hard for blue right now — suspicious timing.",
    "Vote red and survive. We can try blue when there are fewer of us.",
  ];
  const pool = ctx.isWolf ? wolfMessages : innocentMessages;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getOfflineBotVote(ctx: { isWolf: boolean; redCount: number; blueCount: number; aliveCount: number }): "red" | "blue" {
  const bluePct = ctx.aliveCount > 0 ? (ctx.blueCount / ctx.aliveCount) * 100 : 0;

  if (ctx.isWolf) {
    // Wolf: vote with the current majority
    return ctx.redCount >= ctx.blueCount ? "red" : "blue";
  }

  // Innocent: red is ALMOST ALWAYS the safe call
  // Only go blue if blue is currently at a perfect coordination band (50-60%) — very rare
  if (bluePct >= 50 && bluePct <= 60) {
    return "blue"; // looks like a controlled coordination — join it
  }
  // Otherwise: default red
  return "red";
}
