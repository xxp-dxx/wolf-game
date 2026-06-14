import { useState, useEffect, useRef } from "react";
import { GameState, Player, Difficulty, GameMode } from "../types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { motion, AnimatePresence } from "framer-motion";

// ── Countdown hook ─────────────────────────────────────────────────────────────
function useCountdown(endsAt: number | null) {
  const [msLeft, setMsLeft] = useState(0);
  useEffect(() => {
    if (!endsAt) { setMsLeft(0); return; }
    const tick = () => {
      const remaining = endsAt - Date.now();
      setMsLeft(remaining <= 0 ? 0 : remaining);
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [endsAt]);
  return msLeft;
}

function fmtMmSs(ms: number) {
  const totalSecs = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Player tile ────────────────────────────────────────────────────────────────
function PlayerTile({ player, highlight }: { player: Player; highlight?: "wolf" | "dead" }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 1 }}
      animate={{ opacity: player.alive ? 1 : 0.25 }}
      transition={{ duration: 0.6 }}
      className="p-2 border text-center text-xs tracking-widest font-mono uppercase truncate"
      style={{
        textDecoration: player.alive ? undefined : "line-through",
        color: !player.alive
          ? "#3f3f46"
          : highlight === "wolf"
          ? "#FFBF00"
          : player.isBot
          ? "#52525b"
          : "#e4e4e7",
        borderColor: highlight === "wolf" ? "#FFBF00" : player.isBot ? "#1c1c1c" : "#27272a",
        boxShadow: highlight === "wolf" ? "0 0 8px #FFBF00" : undefined,
      }}
    >
      {player.name}
      {player.isYou && <span className="text-[#DC143C] ml-1">*</span>}
      {player.isBot && <span className="text-zinc-700 ml-1 text-[9px]">BOT</span>}
    </motion.div>
  );
}

// ── Wolf identity banner ───────────────────────────────────────────────────────
function WolfBanner({ gameMode }: { gameMode: GameMode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: [0.7, 1, 0.7], y: 0 }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      className="mx-4 mt-2 px-4 py-2 border text-center"
      style={{
        borderColor: "#FFBF00",
        background: "rgba(255,191,0,0.05)",
        boxShadow: "0 0 18px rgba(255,191,0,0.15)",
      }}
    >
      <span className="text-xs font-bold tracking-[0.4em]" style={{ color: "#FFBF00" }}>
        {gameMode === "multi-wolf" ? "YOU ARE ONE OF THE WOLVES." : "YOU ARE THE WOLF."}
      </span>
      <span className="text-[10px] tracking-widest ml-3" style={{ color: "#a16207" }}>
        YOUR IDENTITY IS SECRET.
      </span>
    </motion.div>
  );
}

// ── Spectator banner ──────────────────────────────────────────────────────────
function SpectatorBanner() {
  return (
    <div
      className="mx-4 mt-2 px-4 py-2 border text-center"
      style={{ borderColor: "#3f3f46", background: "rgba(63,63,70,0.2)" }}
    >
      <span className="text-[10px] font-bold tracking-[0.4em] text-zinc-500">
        SPECTATOR MODE — OBSERVATION ONLY
      </span>
    </div>
  );
}

// ── Discussion screen ─────────────────────────────────────────────────────────
function DiscussionScreen({
  gameState,
  sendMessage,
}: {
  gameState: GameState;
  sendMessage: (t: string) => void;
}) {
  const msLeft = useCountdown(gameState.discussionEndsAt);
  const sLeft = Math.ceil(msLeft / 1000);
  const isUrgent = sLeft <= 10 && sLeft > 0;
  const [msg, setMsg] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);
  const isSpectator = gameState.isSpectator;

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [gameState.chat]);

  const submit = () => {
    if (!msg.trim() || isSpectator) return;
    sendMessage(msg.trim());
    setMsg("");
  };

  const alivePlayer = gameState.players.find((p) => p.isYou && p.alive);

  return (
    <motion.div
      key="discussion"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="h-screen flex flex-col bg-black text-gray-300 font-mono"
    >
      {gameState.youAreWolf && <WolfBanner gameMode={gameState.gameMode} />}
      {isSpectator && <SpectatorBanner />}

      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-900">
        <div className="text-xs tracking-widest text-zinc-500">
          ROUND <span className="text-white">{String(gameState.round).padStart(2, "0")}</span>
        </div>
        <motion.div
          key={sLeft}
          animate={isUrgent ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 0.4, repeat: isUrgent ? Infinity : 0 }}
          className="text-4xl font-bold tabular-nums tracking-widest"
          style={{ color: isUrgent ? "#DC143C" : msLeft === 0 ? "#52525b" : "#e4e4e7" }}
        >
          {fmtMmSs(msLeft)}
        </motion.div>
        <div className="text-xs tracking-widest text-zinc-500">
          ALIVE <span className="text-white">{gameState.aliveCount}</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-56 shrink-0 p-3 border-r border-zinc-900 overflow-y-auto">
          <div className="text-[10px] tracking-widest text-zinc-600 mb-2">SUBJECTS</div>
          <div className="space-y-1">
            {gameState.players.map((p) => (
              <PlayerTile key={p.id} player={p} />
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-1">
            {gameState.chat.length === 0 && (
              <div className="text-zinc-700 text-xs tracking-widest text-center mt-8">
                COMMUNICATION OPEN. CHOOSE YOUR WORDS CAREFULLY.
              </div>
            )}
            {gameState.chat.map((m, i) => (
              <div key={i} className="text-sm">
                <span className="text-zinc-500 text-xs">
                  [{new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}]{" "}
                </span>
                <span className="text-[#DC143C] font-bold">{m.playerName}: </span>
                <span className="text-gray-300">{m.text}</span>
              </div>
            ))}
          </div>
          {!isSpectator && (
            <div className="flex gap-2 p-3 border-t border-zinc-900">
              <Input
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder={alivePlayer ? "TRANSMIT MESSAGE..." : "YOU ARE ELIMINATED."}
                maxLength={300}
                disabled={!alivePlayer}
                className="bg-black border-zinc-800 font-mono text-sm rounded-none focus:border-zinc-500"
              />
              <Button
                onClick={submit}
                disabled={!alivePlayer}
                variant="outline"
                className="rounded-none border-zinc-700 font-mono text-xs tracking-widest shrink-0"
              >
                SEND
              </Button>
            </div>
          )}
          {isSpectator && (
            <div className="flex items-center justify-center p-3 border-t border-zinc-900">
              <span className="text-[10px] tracking-widest text-zinc-700">SPECTATORS CANNOT TRANSMIT</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-2 border-t border-zinc-900 text-right">
        <span className="text-[10px] tracking-widest" style={{ color: "#3f3f46" }}>
          {gameState.gameMode === "multi-wolf"
            ? `${gameState.wolfCount} OF YOU ARE WOLVES.`
            : gameState.gameMode === "wolveless"
            ? "NO WOLF THIS ROUND."
            : "ONE OF YOU IS THE WOLF."}
        </span>
      </div>
    </motion.div>
  );
}

// ── Voting screen ─────────────────────────────────────────────────────────────
function VotingScreen({
  gameState,
  castVote,
}: {
  gameState: GameState;
  castVote: (c: "red" | "blue") => void;
}) {
  const msLeft = useCountdown(gameState.votingEndsAt);
  const pct = gameState.votingEndsAt ? (msLeft / 15000) * 100 : 0;
  const [chosen, setChosen] = useState<"red" | "blue" | null>(gameState.myVote ?? null);
  const [hovered, setHovered] = useState<"red" | "blue" | null>(null);
  const isSpectator = gameState.isSpectator;
  const alivePlayer = gameState.players.find((p) => p.isYou && p.alive);

  const handleVote = (color: "red" | "blue") => {
    if (chosen || isSpectator || !alivePlayer) return;
    setChosen(color);
    castVote(color);
  };

  return (
    <motion.div
      key="voting"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-screen flex flex-col bg-black overflow-hidden"
      style={{
        background:
          hovered === "red"
            ? "radial-gradient(ellipse at 25% 50%, rgba(220,20,60,0.07) 0%, black 60%)"
            : hovered === "blue"
            ? "radial-gradient(ellipse at 75% 50%, rgba(0,255,255,0.07) 0%, black 60%)"
            : "black",
      }}
    >
      {gameState.youAreWolf && <WolfBanner gameMode={gameState.gameMode} />}
      {isSpectator && <SpectatorBanner />}

      <div className="px-6 py-4">
        <div className="text-center text-xs tracking-[0.4em] text-zinc-500 mb-2">
          {isSpectator ? "VOTE IN PROGRESS." : "MAKE YOUR CHOICE."}
        </div>
        <div className="h-1 bg-zinc-900 w-full">
          <motion.div
            className="h-full"
            style={{ background: "#DC143C" }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.2 }}
          />
        </div>
        <div className="text-right text-[10px] text-zinc-700 mt-1">
          {gameState.votedCount}/{gameState.aliveCount} VOTED
        </div>
      </div>

      <div className="flex flex-1">
        {isSpectator ? (
          <div className="w-full flex items-center justify-center">
            <div className="text-center space-y-6">
              <div className="flex gap-12 items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl font-bold tracking-widest" style={{ color: "#DC143C" }}>RED</div>
                  <div className="text-zinc-600 text-xs tracking-widest mt-2">{gameState.players.filter(p => p.alive).length - gameState.votedCount} remaining</div>
                </div>
                <div className="text-zinc-800 text-4xl">·</div>
                <div className="text-center">
                  <div className="text-6xl font-bold tracking-widest" style={{ color: "#00FFFF" }}>BLUE</div>
                </div>
              </div>
              <div className="text-zinc-600 text-xs tracking-widest">OBSERVING VOTE</div>
            </div>
          </div>
        ) : chosen ? (
          <div className="w-full flex items-center justify-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [1, 1.02, 1], opacity: 1 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              className="text-center"
            >
              <div
                className="text-8xl font-bold tracking-widest mb-6"
                style={{ color: chosen === "red" ? "#DC143C" : "#00FFFF" }}
              >
                {chosen.toUpperCase()}
              </div>
              <div className="text-xs tracking-[0.5em] text-zinc-600">CHOICE LOCKED.</div>
            </motion.div>
          </div>
        ) : (
          <>
            <button
              onClick={() => handleVote("red")}
              onMouseEnter={() => setHovered("red")}
              onMouseLeave={() => setHovered(null)}
              className="w-1/2 flex items-center justify-center border-r border-zinc-900 transition-all"
              style={{ background: hovered === "red" ? "rgba(220,20,60,0.12)" : "transparent" }}
            >
              <span className="text-8xl font-bold tracking-widest select-none" style={{ color: "#DC143C" }}>RED</span>
            </button>
            <button
              onClick={() => handleVote("blue")}
              onMouseEnter={() => setHovered("blue")}
              onMouseLeave={() => setHovered(null)}
              className="w-1/2 flex items-center justify-center transition-all"
              style={{ background: hovered === "blue" ? "rgba(0,255,255,0.09)" : "transparent" }}
            >
              <span className="text-8xl font-bold tracking-widest select-none" style={{ color: "#00FFFF" }}>BLUE</span>
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── Resolution screen ─────────────────────────────────────────────────────────
function ResolutionScreen({ gameState }: { gameState: GameState }) {
  const res = gameState.resolution;
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
    const timers = [
      setTimeout(() => setStep(1), 1000),
      setTimeout(() => setStep(2), 3000),
      setTimeout(() => setStep(3), 5500),
      setTimeout(() => setStep(4), 8000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  if (!res) return null;

  const casualtySet = new Set(res.casualties);

  return (
    <motion.div
      key="resolution"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-black font-mono text-gray-300 flex flex-col overflow-y-auto"
    >
      <AnimatePresence>
        {step >= 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex h-24 w-full shrink-0"
          >
            <motion.div
              className="flex items-center justify-end pr-4"
              initial={{ width: 0 }}
              animate={{ width: `${res.redPct}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              style={{ background: "rgba(220,20,60,0.8)" }}
            >
              {res.redPct > 10 && (
                <span className="text-lg font-bold tracking-widest text-white whitespace-nowrap">
                  RED {res.redPct.toFixed(0)}%
                </span>
              )}
            </motion.div>
            <motion.div
              className="flex items-center justify-start pl-4"
              initial={{ width: 0 }}
              animate={{ width: `${res.bluePct}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              style={{ background: "rgba(0,255,255,0.6)" }}
            >
              {res.bluePct > 10 && (
                <span className="text-lg font-bold tracking-widest text-black whitespace-nowrap">
                  BLUE {res.bluePct.toFixed(0)}%
                </span>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 px-6 py-6 space-y-6 max-w-2xl mx-auto w-full">
        {/* Overpopulation */}
        <AnimatePresence>
          {step >= 2 && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-1">
              <div className="text-[10px] tracking-widest text-zinc-600">RULE CHECK 1/3</div>
              {res.overpopulation ? (
                <motion.div
                  animate={{ backgroundColor: ["#000", "#1a0000", "#000"] }}
                  transition={{ duration: 0.4, repeat: 3 }}
                  className="p-4 border border-[#DC143C]"
                >
                  <div className="text-[#DC143C] tracking-widest text-sm font-bold">OVERPOPULATION DETECTED</div>
                  <div className="text-white mt-1 text-xs tracking-widest">SYSTEM OVERLOAD. ALL SUBJECTS TERMINATED.</div>
                </motion.div>
              ) : (
                <div className="p-4 border border-zinc-900 text-zinc-600 text-sm tracking-widest" style={{ textDecoration: "line-through" }}>
                  OVERPOPULATION (&gt;{gameState.overpopulationThresholdPct}% BLUE) — NEGATIVE
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wolf identity — FIX: always show wolf, even spectator */}
        {!res.overpopulation && step >= 3 && gameState.gameMode !== "wolveless" && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-2">
            <div className="text-[10px] tracking-widest text-zinc-600">RULE CHECK 2/3</div>
            <div
              className="p-4 border"
              style={{ borderColor: "#FFBF00", boxShadow: "0 0 12px rgba(255,191,0,0.2)" }}
            >
              <div className="text-sm font-bold tracking-widest mb-1" style={{ color: "#FFBF00" }}>
                WOLF IDENTITY CONFIRMED
              </div>
              <div className="text-white text-xs tracking-widest">
                THE WOLF: <span style={{ color: "#FFBF00" }}>{res.wolfName}</span>
              </div>
              <div className="text-zinc-400 text-xs tracking-widest mt-1">
                THE WOLF VOTED:{" "}
                <span style={{ color: res.wolfVote === "red" ? "#DC143C" : "#00FFFF" }}>
                  {res.wolfVote.toUpperCase()}
                </span>
              </div>
              {res.wolfBiteActivated ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="mt-3 text-[#DC143C] text-xs tracking-widest font-bold"
                >
                  WOLF IN MAJORITY. THE MINORITY BLEEDS.
                </motion.div>
              ) : (
                <div className="mt-3 text-zinc-500 text-xs tracking-widest" style={{ textDecoration: "line-through" }}>
                  WOLF IN MINORITY. BITE FAILED.
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Standard resolution */}
        {!res.overpopulation && !res.wolfBiteActivated && step >= 4 && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-2">
            <div className="text-[10px] tracking-widest text-zinc-600">RULE CHECK 3/3</div>
            <div className="p-4 border border-zinc-800">
              <div className="text-sm font-bold tracking-widest text-white mb-1">STANDARD RESOLUTION</div>
              {res.peacefulRound ? (
                <div className="text-[#00FFFF] text-xs tracking-widest">
                  51-{gameState.overpopulationThresholdPct}% BLUE. PEACE ACHIEVED. NO CASUALTIES.
                </div>
              ) : (
                <div className="text-[#DC143C] text-xs tracking-widest">
                  COOPERATION FAILED. BLUE VOTERS ELIMINATED.
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Casualties */}
        {step >= 4 && res.casualties.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            <div className="text-[10px] tracking-widest text-zinc-600">
              CASUALTIES THIS ROUND ({res.casualties.length})
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {gameState.players
                .filter((p) => casualtySet.has(p.name))
                .map((p) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 1, scale: 1 }}
                    animate={{ opacity: 0.3, scale: 0.95 }}
                    transition={{ duration: 0.8, delay: Math.random() * 0.5 }}
                    className="p-2 border border-zinc-900 text-center text-xs tracking-widest text-zinc-600"
                    style={{ textDecoration: "line-through" }}
                  >
                    {p.name}
                    {p.isYou && " *"}
                  </motion.div>
                ))}
            </div>
          </motion.div>
        )}

        {step >= 4 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center pt-4 text-xl tracking-widest text-white"
          >
            {gameState.aliveCount} SUBJECTS REMAIN
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ── Condition check screen ────────────────────────────────────────────────────
function ConditionCheckScreen({ gameState }: { gameState: GameState }) {
  const res = gameState.resolution;
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
    const timers = [
      setTimeout(() => setStep(1), 800),
      setTimeout(() => setStep(2), 2000),
      setTimeout(() => setStep(3), 3500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const [countdown, setCountdown] = useState(5);
  useEffect(() => {
    if (step < 3) return;
    setCountdown(5);
    const id = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [step]);

  if (!res) return null;

  const prevAlive = res.survivorCount + res.casualties.length;
  const isVictory = res.clearCondition !== null;
  const bloodbathPct = gameState.startingPlayerCount > 0
    ? Math.round((gameState.bloodbathThreshold / gameState.startingPlayerCount) * 100)
    : 30;

  return (
    <motion.div
      key="condition_check"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-black font-mono text-gray-300 flex flex-col items-center justify-center p-8 space-y-10"
    >
      {step >= 1 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="text-zinc-600 text-xs tracking-widest mb-4">ROUND {gameState.round} TALLY</div>
          <div className="text-4xl font-bold tracking-widest text-white">
            <span className="text-zinc-400">{prevAlive}</span>
            <span className="text-zinc-600 mx-4">−</span>
            <span className="text-[#DC143C]">{res.casualties.length}</span>
            <span className="text-zinc-600 mx-4">=</span>
            <span className="text-white">{res.survivorCount}</span>
          </div>
          <div className="text-zinc-600 text-xs tracking-widest mt-2">SUBJECTS REMAINING</div>
        </motion.div>
      )}

      {step >= 2 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 w-full max-w-md">
          <div
            className="p-4 border tracking-widest text-sm"
            style={{ borderColor: res.clearCondition === "bloodbath" ? "#00FFFF" : "#27272a" }}
          >
            <div className="text-zinc-500 text-[10px] mb-1">CONDITION 1</div>
            <div className="text-white">
              BLOODBATH: SURVIVORS ≤ {gameState.bloodbathThreshold}
              <span className="text-zinc-600 text-[10px] ml-2">({bloodbathPct}% OF {gameState.startingPlayerCount})</span>
            </div>
            <div className="text-xs mt-1" style={{ color: res.clearCondition === "bloodbath" ? "#00FFFF" : "#52525b" }}>
              {res.clearCondition === "bloodbath"
                ? "QUOTA MET. SURVIVORS RELEASED."
                : `${res.survivorCount} REMAINING — NEGATIVE`}
            </div>
          </div>

          {gameState.gameMode !== "wolveless" && (
            <div
              className="p-4 border tracking-widest text-sm"
              style={{ borderColor: res.clearCondition === "blind_martyr" ? "#FFBF00" : "#27272a" }}
            >
              <div className="text-zinc-500 text-[10px] mb-1">CONDITION 2</div>
              <div className="text-white">
                BLIND MARTYR: WOLF VOTED BLUE + BLUE ≤ {gameState.blindMartyrThresholdPct}%
              </div>
              <div className="text-xs mt-1" style={{ color: res.clearCondition === "blind_martyr" ? "#FFBF00" : "#52525b" }}>
                {res.clearCondition === "blind_martyr" ? "THE WOLF HAS SACRIFICED THEMSELVES." : "NEGATIVE"}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {step >= 3 && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          {isVictory ? (
            <div className="text-[#00FFFF] text-2xl font-bold tracking-widest">SURVIVORS RELEASED.</div>
          ) : (
            <>
              <div className="text-zinc-400 text-sm tracking-widest mb-2">CONDITIONS NOT MET.</div>
              <div className="text-zinc-500 text-xs tracking-widest">
                INITIATING ROUND {gameState.round + 1} IN {countdown}s
              </div>
              <div className="mt-4 h-1 bg-zinc-900 w-48 mx-auto">
                <motion.div
                  className="h-full bg-zinc-600"
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: 5, ease: "linear" }}
                />
              </div>
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Post-match stats ───────────────────────────────────────────────────────────
function PostMatchStats({ gameState }: { gameState: GameState }) {
  const totalCasualties = gameState.history.reduce((s, r) => s + r.casualties.length, 0);
  return (
    <div className="space-y-6 max-w-xl mx-auto w-full">
      <div className="grid grid-cols-2 gap-4 text-center">
        <div className="border border-zinc-800 p-4">
          <div className="text-2xl font-bold text-white">{gameState.round}</div>
          <div className="text-xs text-zinc-600 tracking-widest mt-1">ROUNDS</div>
        </div>
        <div className="border border-zinc-800 p-4">
          <div className="text-2xl font-bold text-[#DC143C]">{totalCasualties}</div>
          <div className="text-xs text-zinc-600 tracking-widest mt-1">TOTAL CASUALTIES</div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-[10px] tracking-widest text-zinc-600 border-b border-zinc-900 pb-1">WOLF HISTORY</div>
        {gameState.history.map((r) => (
          <div key={r.round} className="flex items-center justify-between text-xs border border-zinc-900 p-3">
            <span className="text-zinc-500">RND {String(r.round).padStart(2, "0")}</span>
            <span className="text-white tracking-widest">{r.wolfName}</span>
            <span style={{ color: r.wolfVote === "red" ? "#DC143C" : "#00FFFF" }}>
              VOTED {r.wolfVote.toUpperCase()}
            </span>
            <span className="text-zinc-600">{r.casualties.length > 0 ? `−${r.casualties.length}` : "PEACE"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Spectator Dashboard ────────────────────────────────────────────────────────
function SpectatorDashboard({ gameState }: { gameState: GameState }) {
  const msLeft = useCountdown(
    gameState.phase === "discussion" ? gameState.discussionEndsAt :
    gameState.phase === "voting" ? gameState.votingEndsAt : null
  );

  const alive = gameState.players.filter((p) => p.alive);
  const dead = gameState.players.filter((p) => !p.alive);

  return (
    <div className="min-h-screen bg-black font-mono text-gray-300 p-4 space-y-4">
      <div
        className="border px-4 py-2 text-center text-[10px] tracking-[0.4em] text-zinc-500"
        style={{ borderColor: "#27272a" }}
      >
        SPECTATOR INTELLIGENCE FEED
      </div>

      {/* Status bar */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs border border-zinc-900">
        <div className="border-r border-zinc-900 p-3">
          <div className="text-zinc-500 text-[9px] tracking-widest mb-1">ROUND</div>
          <div className="text-white text-xl font-bold">{String(gameState.round).padStart(2, "0")}</div>
        </div>
        <div className="border-r border-zinc-900 p-3">
          <div className="text-zinc-500 text-[9px] tracking-widest mb-1">ALIVE</div>
          <div className="text-white text-xl font-bold">{gameState.aliveCount}</div>
        </div>
        <div className="border-r border-zinc-900 p-3">
          <div className="text-zinc-500 text-[9px] tracking-widest mb-1">PHASE</div>
          <div className="text-[#DC143C] text-xs font-bold tracking-wider pt-1">{gameState.phase.replace("_", " ").toUpperCase()}</div>
        </div>
        <div className="p-3">
          <div className="text-zinc-500 text-[9px] tracking-widest mb-1">TIME</div>
          <div
            className="text-xl font-bold tabular-nums"
            style={{ color: msLeft > 0 ? "#e4e4e7" : "#52525b" }}
          >
            {gameState.phase === "discussion" || gameState.phase === "voting" ? fmtMmSs(msLeft) : "—"}
          </div>
        </div>
      </div>

      {/* Wolf reveal (spectators see wolf identity) */}
      {gameState.phase !== "lobby" && gameState.phase !== "briefing" && gameState.gameMode !== "wolveless" && gameState.resolution && (
        <div
          className="border p-3"
          style={{ borderColor: "#FFBF00", background: "rgba(255,191,0,0.03)" }}
        >
          <div className="text-[9px] tracking-widest text-zinc-600 mb-1">CURRENT ROUND WOLF</div>
          <div className="text-sm font-bold tracking-widest" style={{ color: "#FFBF00" }}>
            {gameState.resolution.wolfName}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">
            VOTED{" "}
            <span style={{ color: gameState.resolution.wolfVote === "red" ? "#DC143C" : "#00FFFF" }}>
              {gameState.resolution.wolfVote.toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Vote progress (during voting) */}
      {gameState.phase === "voting" && (
        <div className="border border-zinc-900 p-3 space-y-2">
          <div className="text-[9px] tracking-widest text-zinc-600">VOTE PROGRESS</div>
          <div className="flex justify-between text-xs text-zinc-500">
            <span>{gameState.votedCount} / {gameState.aliveCount} VOTED</span>
            <span>{gameState.aliveCount - gameState.votedCount} REMAINING</span>
          </div>
          <div className="h-1 bg-zinc-900 w-full">
            <div
              className="h-full"
              style={{
                background: "#DC143C",
                width: `${gameState.aliveCount > 0 ? (gameState.votedCount / gameState.aliveCount) * 100 : 0}%`,
                transition: "width 0.3s",
              }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Alive players */}
        <div className="border border-zinc-900 p-3 space-y-2">
          <div className="text-[9px] tracking-widest text-zinc-600 border-b border-zinc-900 pb-1">
            ALIVE ({alive.length})
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {alive.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="text-zinc-300 tracking-widest truncate">{p.name}</span>
                {p.isBot && <span className="text-zinc-700 text-[9px]">BOT</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Eliminated players */}
        <div className="border border-zinc-900 p-3 space-y-2">
          <div className="text-[9px] tracking-widest text-zinc-600 border-b border-zinc-900 pb-1">
            ELIMINATED ({dead.length})
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {dead.map((p) => (
              <div key={p.id} className="text-xs text-zinc-700 tracking-widest line-through truncate">
                {p.name}
              </div>
            ))}
            {dead.length === 0 && (
              <div className="text-zinc-800 text-[10px] tracking-widest">NONE YET</div>
            )}
          </div>
        </div>
      </div>

      {/* Chat feed */}
      {gameState.phase === "discussion" && (
        <div className="border border-zinc-900 p-3 space-y-2">
          <div className="text-[9px] tracking-widest text-zinc-600 border-b border-zinc-900 pb-1">LIVE TRANSMISSIONS</div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {gameState.chat.length === 0 && (
              <div className="text-zinc-800 text-[10px] tracking-widest">AWAITING TRANSMISSIONS...</div>
            )}
            {gameState.chat.slice(-20).map((m, i) => (
              <div key={i} className="text-xs">
                <span className="text-[#DC143C]">{m.playerName}: </span>
                <span className="text-zinc-400">{m.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {gameState.history.length > 0 && (
        <div className="border border-zinc-900 p-3 space-y-2">
          <div className="text-[9px] tracking-widest text-zinc-600 border-b border-zinc-900 pb-1">ROUND HISTORY</div>
          <div className="space-y-1">
            {gameState.history.slice(-5).reverse().map((r) => (
              <div key={r.round} className="flex items-center justify-between text-[10px] text-zinc-500">
                <span>R{r.round}</span>
                <span className="text-zinc-400">{r.wolfName}</span>
                <span style={{ color: r.wolfVote === "red" ? "#DC143C" : "#00FFFF" }}>{r.wolfVote.toUpperCase()}</span>
                <span>{r.casualties.length > 0 ? `−${r.casualties.length}` : "PEACE"}</span>
                {r.clearCondition && <span style={{ color: "#00FFFF" }}>{r.clearCondition === "bloodbath" ? "✦" : "◆"}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Difficulty button ─────────────────────────────────────────────────────────
function DifficultyButton({
  value, current, label, sub, onClick,
}: { value: string; current: string; label: string; sub: string; onClick: () => void }) {
  const active = value === current;
  return (
    <button
      onClick={onClick}
      className="flex-1 p-2 border text-left transition-colors"
      style={{
        borderColor: active ? "#DC143C" : "#27272a",
        background: active ? "rgba(220,20,60,0.08)" : "transparent",
      }}
    >
      <div className="text-[10px] font-bold tracking-widest" style={{ color: active ? "#DC143C" : "#a1a1aa" }}>
        {label}
      </div>
      <div className="text-[9px] tracking-wide text-zinc-600 mt-0.5">{sub}</div>
    </button>
  );
}

// ── Root Screens component ─────────────────────────────────────────────────────
export function Screens({
  gameState,
  isHost,
  isSpectator,
  createLobby,
  joinLobby,
  joinPublicLobby,
  startGame,
  acknowledgeRules,
  sendMessage,
  castVote,
  spectateLobby,
}: any) {
  const [playerName, setPlayerName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [spectateCode, setSpectateCode] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [botCount, setBotCount] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [gameMode, setGameMode] = useState<GameMode>("standard");
  const [wolfCount, setWolfCount] = useState(2);
  const [tab, setTab] = useState<"play" | "spectate">("play");

  // Home screen
  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-black text-gray-200 font-mono">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-md w-full space-y-8 text-center"
        >
          <div className="space-y-2">
            <motion.h1
              className="text-6xl font-bold tracking-widest text-white"
              animate={{ opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              THE WOLF
            </motion.h1>
            <p className="text-xs tracking-[0.5em] text-zinc-500 uppercase">A clinical death-game.</p>
          </div>

          {/* Tab switcher */}
          <div className="flex border border-zinc-900">
            <button
              onClick={() => setTab("play")}
              className="flex-1 py-2 text-[10px] tracking-widest transition-colors"
              style={{
                background: tab === "play" ? "rgba(220,20,60,0.08)" : "transparent",
                color: tab === "play" ? "#DC143C" : "#52525b",
                borderRight: "1px solid #18181b",
              }}
            >
              PLAY
            </button>
            <button
              onClick={() => setTab("spectate")}
              className="flex-1 py-2 text-[10px] tracking-widest transition-colors"
              style={{
                background: tab === "spectate" ? "rgba(63,63,70,0.3)" : "transparent",
                color: tab === "spectate" ? "#a1a1aa" : "#52525b",
              }}
            >
              SPECTATE
            </button>
          </div>

          {tab === "play" ? (
            <div className="space-y-4">
              <Input
                placeholder="ENTER SUBJECT NAME"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value.slice(0, 20))}
                className="text-center font-mono bg-zinc-950 border-zinc-800 focus:border-zinc-500 rounded-none tracking-widest"
              />

              {/* Difficulty */}
              <div className="border border-zinc-900 p-3 space-y-2">
                <div className="text-[10px] tracking-widest text-zinc-600 text-left">DIFFICULTY</div>
                <div className="flex gap-1.5">
                  <DifficultyButton value="easy" current={difficulty} label="EASY" sub="40% thresholds · 3 min" onClick={() => setDifficulty("easy")} />
                  <DifficultyButton value="normal" current={difficulty} label="NORMAL" sub="30% thresholds · 2 min" onClick={() => setDifficulty("normal")} />
                  <DifficultyButton value="hard" current={difficulty} label="HARD" sub="20% thresholds · 1 min" onClick={() => setDifficulty("hard")} />
                </div>
              </div>

              {/* Game mode */}
              <div className="border border-zinc-900 p-3 space-y-2">
                <div className="text-[10px] tracking-widest text-zinc-600 text-left">GAME MODE</div>
                <div className="flex gap-1.5">
                  <DifficultyButton value="standard" current={gameMode} label="STANDARD" sub="1 wolf / round" onClick={() => setGameMode("standard")} />
                  <DifficultyButton value="wolveless" current={gameMode} label="WOLVELESS" sub="No wolf, pure vote" onClick={() => setGameMode("wolveless")} />
                  <DifficultyButton value="multi-wolf" current={gameMode} label="PACK" sub="Multiple wolves" onClick={() => setGameMode("multi-wolf")} />
                </div>
                {gameMode === "multi-wolf" && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] tracking-widest text-zinc-600">WOLF COUNT</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setWolfCount((c) => Math.max(2, c - 1))}
                        className="w-6 h-6 border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white font-mono flex items-center justify-center transition-colors"
                      >−</button>
                      <span className="text-white font-bold tabular-nums w-6 text-center">{wolfCount}</span>
                      <button
                        onClick={() => setWolfCount((c) => Math.min(10, c + 1))}
                        className="w-6 h-6 border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white font-mono flex items-center justify-center transition-colors"
                      >+</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Bot count */}
              <div className="border border-zinc-900 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] tracking-widest text-zinc-600">BOTS</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setBotCount((c) => Math.max(0, c - 1))}
                      className="w-7 h-7 border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white font-mono text-lg leading-none flex items-center justify-center transition-colors"
                    >−</button>
                    <span className="text-white font-bold text-lg tabular-nums w-8 text-center">{botCount}</span>
                    <button
                      onClick={() => setBotCount((c) => Math.min(99, c + 1))}
                      className="w-7 h-7 border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white font-mono text-lg leading-none flex items-center justify-center transition-colors"
                    >+</button>
                  </div>
                </div>
                {botCount > 0 && (
                  <div className="text-[10px] tracking-widest text-right"
                    style={{ color: botCount + 1 >= 8 ? "#52525b" : "#DC143C" }}>
                    {botCount + 1 >= 8
                      ? `${botCount + 1} TOTAL — READY TO START`
                      : `${8 - (botCount + 1)} MORE NEEDED FOR MINIMUM`}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 justify-between">
                <label className="text-[10px] tracking-widest text-zinc-600 flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="accent-red-600" />
                  PRIVATE
                </label>
                <Button
                  onClick={() => playerName.trim() && createLobby(playerName.trim(), isPrivate, botCount, difficulty, gameMode, wolfCount)}
                  disabled={!playerName.trim()}
                  variant="outline"
                  className="flex-1 rounded-none border-zinc-700 hover:bg-white hover:text-black font-mono tracking-wider"
                >
                  CREATE LOBBY
                </Button>
                <Button
                  onClick={() => playerName.trim() && joinPublicLobby(playerName.trim())}
                  disabled={!playerName.trim()}
                  variant="outline"
                  className="flex-1 rounded-none border-zinc-700 hover:bg-white hover:text-black font-mono tracking-wider"
                >
                  FIND MATCH
                </Button>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="LOBBY CODE"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="text-center font-mono bg-zinc-950 border-zinc-800 rounded-none tracking-widest uppercase"
                  maxLength={6}
                />
                <Button
                  onClick={() => playerName.trim() && joinCode.length === 6 && joinLobby(joinCode, playerName.trim())}
                  disabled={!playerName.trim() || joinCode.length !== 6}
                  variant="outline"
                  className="rounded-none border-zinc-700 hover:bg-white hover:text-black font-mono tracking-wider w-1/3"
                >
                  JOIN
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border border-zinc-900 p-4 space-y-3">
                <div className="text-[10px] tracking-widest text-zinc-600 text-left">OBSERVE A GAME</div>
                <p className="text-[10px] text-zinc-700 tracking-widest text-left leading-relaxed">
                  Enter a lobby code to watch a game in progress. You will see all player statuses, chat, and wolf identity. You cannot interact.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="LOBBY CODE"
                    value={spectateCode}
                    onChange={(e) => setSpectateCode(e.target.value.toUpperCase())}
                    className="text-center font-mono bg-zinc-950 border-zinc-800 rounded-none tracking-widest uppercase"
                    maxLength={6}
                  />
                  <Button
                    onClick={() => spectateCode.length === 6 && spectateLobby(spectateCode)}
                    disabled={spectateCode.length !== 6}
                    variant="outline"
                    className="rounded-none border-zinc-700 hover:bg-white hover:text-black font-mono tracking-wider w-1/3"
                  >
                    OBSERVE
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="text-[10px] tracking-widest text-zinc-700 border-t border-zinc-900 pt-4">
            8 MINIMUM · 100 MAXIMUM · ONE OF THEM IS THE WOLF
          </div>
        </motion.div>
      </div>
    );
  }

  // Spectator mode — show dashboard for all phases
  if (gameState.isSpectator) {
    const phase = gameState.phase;
    if (phase === "game_over" || phase === "victory") {
      return (
        <div className="min-h-screen bg-black font-mono flex flex-col items-center justify-center p-8 space-y-10">
          <SpectatorBanner />
          <motion.h1
            className="text-5xl font-bold tracking-widest"
            style={{ color: phase === "victory" ? "#e4e4e7" : "#DC143C" }}
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {phase === "victory" ? "SURVIVAL CONFIRMED." : "NO SURVIVORS."}
          </motion.h1>
          <PostMatchStats gameState={gameState} />
          <Button onClick={() => window.location.reload()} variant="outline" className="rounded-none border-zinc-700 text-white font-mono tracking-wider">
            EXIT SPECTATE
          </Button>
        </div>
      );
    }
    if (phase === "discussion") {
      return (
        <div className="flex flex-col h-screen bg-black">
          <DiscussionScreen gameState={gameState} sendMessage={sendMessage} />
        </div>
      );
    }
    if (phase === "voting") {
      return <VotingScreen gameState={gameState} castVote={castVote} />;
    }
    if (phase === "resolution") {
      return <ResolutionScreen gameState={gameState} />;
    }
    if (phase === "condition_check") {
      return <ConditionCheckScreen gameState={gameState} />;
    }
    return <SpectatorDashboard gameState={gameState} />;
  }

  const phase = gameState.phase;

  return (
    <div className="bg-black font-mono" style={{ minHeight: "100dvh" }}>
      <AnimatePresence mode="wait">
        {/* ── Lobby ── */}
        {phase === "lobby" && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-6 max-w-4xl mx-auto space-y-8 min-h-screen"
          >
            <div className="text-center space-y-4 border-b border-zinc-900 pb-8 pt-6">
              <div className="text-xs tracking-[0.4em] text-zinc-500">
                SUBJECTS ASSEMBLED: <span className="text-white">{gameState.playerCount}</span>/100
              </div>
              <div className="text-5xl font-bold tracking-[0.3em] text-white bg-zinc-950 border border-zinc-800 inline-block px-10 py-4">
                {gameState.lobbyId}
              </div>
              <div className="text-[10px] tracking-widest text-zinc-600">LOBBY CODE — SHARE TO RECRUIT</div>
              <div className="flex gap-4 justify-center text-[10px] tracking-widest text-zinc-700">
                <span>{gameState.difficulty?.toUpperCase()}</span>
                <span>·</span>
                <span>{gameState.gameMode === "multi-wolf" ? `PACK (${gameState.wolfCount} WOLVES)` : gameState.gameMode?.toUpperCase()}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {gameState.players.map((p: Player) => (
                <div
                  key={p.id}
                  className="p-2 border border-zinc-900 text-center text-xs tracking-widest uppercase truncate"
                  style={{ color: p.isYou ? "#DC143C" : "#a1a1aa" }}
                >
                  {p.name}
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center pt-4 space-y-4">
              {isHost ? (
                <Button
                  onClick={startGame}
                  disabled={gameState.playerCount < 8}
                  className="rounded-none bg-[#DC143C] hover:bg-red-700 text-white px-16 py-6 text-xl tracking-[0.3em] disabled:bg-zinc-900 disabled:text-zinc-700"
                >
                  INITIATE SEQUENCE
                </Button>
              ) : (
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-zinc-500 tracking-[0.3em] text-xs"
                >
                  AWAITING HOST COMMAND
                </motion.div>
              )}
              {gameState.playerCount < 8 && (
                <div className="text-[10px] text-zinc-700 tracking-widest">
                  MINIMUM: 8 SUBJECTS · {8 - gameState.playerCount} MORE NEEDED
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Briefing ── */}
        {phase === "briefing" && (
          <motion.div
            key="briefing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-6 max-w-2xl mx-auto h-screen flex flex-col py-8"
          >
            <h2 className="text-lg font-bold text-[#DC143C] border-b border-red-900 pb-2 tracking-widest">RULE BRIEFING</h2>
            <div className="flex-1 overflow-y-auto mt-4 border border-zinc-900 p-6 bg-zinc-950 text-sm text-zinc-400 space-y-4 leading-relaxed">
              <p className="text-white font-bold tracking-widest">THE SETUP</p>
              {gameState.gameMode === "wolveless" ? (
                <p>Up to 100 players. Minimum 8. This game has no Wolf — rounds are resolved by pure vote mechanics.</p>
              ) : gameState.gameMode === "multi-wolf" ? (
                <p>Up to 100 players. Minimum 8. Each round, <span className="text-[#FFBF00]">{gameState.wolfCount} random players</span> are secretly designated as Wolves. For the Pack Bite to activate, <span className="text-[#FFBF00]">all wolves must vote the same color</span>.</p>
              ) : (
                <p>Up to 100 players. Minimum 8. Every round, one random player is secretly designated as The Wolf. <span className="text-[#FFBF00]">The Wolf knows their identity.</span></p>
              )}
              <p className="text-white font-bold tracking-widest mt-2">VOTE HIERARCHY — RESOLVED IN ORDER</p>
              <p className="text-[#DC143C] font-bold">1. OVERPOPULATION</p>
              <p>If more than {gameState.overpopulationThresholdPct ?? 70}% of players vote Blue, the system overloads. Everyone dies.</p>
              {gameState.gameMode !== "wolveless" && (
                <>
                  <p className="text-[#FFBF00] font-bold">2. THE WOLF'S BITE</p>
                  <p>If the Wolf voted for the Majority color, the Wolf's Bite activates: all players who voted for the Minority color die.</p>
                </>
              )}
              <p className="text-zinc-300 font-bold">{gameState.gameMode !== "wolveless" ? "3." : "2."} STANDARD RESOLUTION</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>51% to {gameState.overpopulationThresholdPct ?? 70}% Blue → Peaceful round. Everyone survives.</li>
                <li>50% or less Blue → Red survives. Blue voters die.</li>
              </ul>
              <p className="text-white font-bold tracking-widest mt-2">CLEAR CONDITIONS</p>
              <p className="text-[#00FFFF] font-bold">THE BLOODBATH</p>
              <p>If survivors drops to {gameState.bloodbathThreshold} or fewer, all remaining players are freed.</p>
              {gameState.gameMode !== "wolveless" && (
                <>
                  <p className="text-[#00FFFF] font-bold">THE BLIND MARTYR</p>
                  <p>If the Wolf voted Blue AND total Blue votes were {gameState.blindMartyrThresholdPct ?? 30}% or less: the Wolf and Blue voters die, but their sacrifice permanently frees survivors.</p>
                </>
              )}
              <p className="text-zinc-600 text-xs mt-4">NOTE: To escape, you cannot simply vote 100% Red forever. You must risk some Blue votes to trigger an exit condition.</p>
            </div>
            <div className="mt-4 space-y-3">
              <Button
                onClick={acknowledgeRules}
                disabled={gameState.players.find((p: Player) => p.isYou)?.acknowledged}
                className="w-full rounded-none bg-[#DC143C] hover:bg-red-700 text-white py-6 text-lg tracking-[0.3em] uppercase disabled:bg-zinc-900 disabled:text-zinc-600"
              >
                {gameState.players.find((p: Player) => p.isYou)?.acknowledged ? "ACKNOWLEDGED" : "ACKNOWLEDGE & ENTER"}
              </Button>
              <div className="text-center text-zinc-600 text-[10px] tracking-widest">
                ACKNOWLEDGED: {gameState.players.filter((p: Player) => p.acknowledged).length}/{gameState.playerCount}
              </div>
            </div>
          </motion.div>
        )}

        {phase === "discussion" && (
          <DiscussionScreen key="discussion" gameState={gameState} sendMessage={sendMessage} />
        )}

        {phase === "voting" && (
          <VotingScreen key="voting" gameState={gameState} castVote={castVote} />
        )}

        {phase === "resolution" && (
          <ResolutionScreen key="resolution" gameState={gameState} />
        )}

        {phase === "condition_check" && (
          <ConditionCheckScreen key="condition_check" gameState={gameState} />
        )}

        {phase === "game_over" && (
          <motion.div
            key="game_over"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen flex flex-col items-center justify-center p-8 bg-black space-y-10"
          >
            <motion.h1
              className="text-7xl font-bold tracking-widest"
              style={{ color: "#DC143C" }}
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              NO SURVIVORS.
            </motion.h1>
            <p className="text-zinc-600 tracking-[0.4em] text-xs">SYSTEM TERMINATED.</p>
            <PostMatchStats gameState={gameState} />
            <Button onClick={() => window.location.reload()} variant="outline" className="rounded-none border-zinc-700 text-white font-mono tracking-wider">
              RETURN TO LOBBY
            </Button>
          </motion.div>
        )}

        {phase === "victory" && (
          <motion.div
            key="victory"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen flex flex-col items-center justify-center p-8 bg-black space-y-10"
          >
            <motion.h1
              className="text-7xl font-bold tracking-widest text-white"
              animate={{ opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              SURVIVAL CONFIRMED.
            </motion.h1>
            {gameState.resolution?.clearCondition === "blind_martyr" && (
              <p className="text-[#FFBF00] tracking-widest text-sm">THE WOLF SACRIFICED THEMSELVES.</p>
            )}
            {gameState.resolution?.clearCondition === "bloodbath" && (
              <p className="text-[#00FFFF] tracking-widest text-sm">QUOTA MET. SURVIVORS RELEASED.</p>
            )}
            <PostMatchStats gameState={gameState} />
            <Button onClick={() => window.location.reload()} variant="outline" className="rounded-none border-zinc-700 text-white font-mono tracking-wider">
              PLAY AGAIN
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
