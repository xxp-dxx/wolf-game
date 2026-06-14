import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { GameState, Difficulty, GameMode } from "../types";
import { useToast } from "@/hooks/use-toast";

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicLobbies, setPublicLobbies] = useState<any[]>([]);
  const { toast } = useToast();

  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current) return socketRef.current;
    // VITE_API_URL lets you point at a separate backend host.
    // Leave it unset when frontend and backend share the same domain.
    const apiUrl = (import.meta as any).env?.VITE_API_URL ?? "";
    const newSocket = io(apiUrl, { path: "/socket.io" });
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on("state_update", (state: GameState) => {
      setGameState(state);
    });

    newSocket.on("chat_message", (msg: import("../types").ChatMessage) => {
      setGameState((prev) => {
        if (!prev) return prev;
        return { ...prev, chat: [...prev.chat, msg] };
      });
    });

    newSocket.on("lobby_joined", (data: { lobbyId: string; isHost: boolean; isSpectator?: boolean }) => {
      setLobbyId(data.lobbyId);
      setIsHost(data.isHost);
      setIsSpectator(data.isSpectator ?? false);
    });

    newSocket.on("public_lobbies", (lobbies: any[]) => {
      setPublicLobbies(lobbies);
    });

    newSocket.on("error", (err: { message: string }) => {
      setError(err.message);
      toast({
        title: "SYSTEM ERROR",
        description: err.message,
        variant: "destructive",
      });
    });

    newSocket.on("disconnect", () => {
      setError("CONNECTION LOST.");
    });

    return newSocket;
  }, [toast]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setGameState(null);
      setLobbyId(null);
      setIsHost(false);
      setIsSpectator(false);
    }
  }, []);

  const createLobby = useCallback((
    name: string,
    isPrivate: boolean,
    botCount = 0,
    difficulty: Difficulty = "normal",
    gameMode: GameMode = "standard",
    wolfCount = 2,
  ) => {
    const s = socketRef.current || connect();
    s.emit("create_lobby", { name, isPrivate, botCount, difficulty, gameMode, wolfCount });
  }, [connect]);

  const joinLobby = useCallback((id: string, name: string) => {
    const s = socketRef.current || connect();
    s.emit("join_lobby", { lobbyId: id, name });
  }, [connect]);

  const joinPublicLobby = useCallback((name: string) => {
    const s = socketRef.current || connect();
    s.emit("join_public_lobby", { name });
  }, [connect]);

  const getPublicLobbies = useCallback(() => {
    const s = socketRef.current || connect();
    s.emit("get_public_lobbies");
  }, [connect]);

  const startGame = useCallback(() => {
    socketRef.current?.emit("start_game");
  }, []);

  const acknowledgeRules = useCallback(() => {
    socketRef.current?.emit("acknowledge_rules");
  }, []);

  const sendMessage = useCallback((text: string) => {
    socketRef.current?.emit("send_message", { text });
  }, []);

  const castVote = useCallback((color: "red" | "blue") => {
    socketRef.current?.emit("cast_vote", { color });
  }, []);

  const spectateLobby = useCallback((lobbyId: string) => {
    const s = socketRef.current || connect();
    s.emit("spectate_lobby", { lobbyId });
  }, [connect]);

  return {
    socket,
    gameState,
    lobbyId,
    isHost,
    isSpectator,
    error,
    publicLobbies,
    connect,
    disconnect,
    createLobby,
    joinLobby,
    joinPublicLobby,
    getPublicLobbies,
    startGame,
    acknowledgeRules,
    sendMessage,
    castVote,
    spectateLobby,
  };
}
