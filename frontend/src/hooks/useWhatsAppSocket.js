"use client";

/**
 * useWhatsAppSocket.js
 *
 * Custom React hook that manages the Socket.io connection lifecycle
 * for a single WhatsApp shop session.
 *
 * Emitted server events handled:
 *   "status" { status: "connecting" | "connected" | "disconnected" }
 *   "qr"     { qr: string }
 *   "error"  { message: string }
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

/**
 * @typedef {"idle" | "connecting" | "connected" | "disconnected" | "error"} ConnectionStatus
 */

/**
 * @param {string} shopId  - Unique tenant / shop identifier
 */
export function useWhatsAppSocket(shopId) {
  /** @type {[ConnectionStatus, Function]} */
  const [status, setStatus]   = useState("idle");
  const [qrCode, setQrCode]   = useState(null);   // raw QR string from server
  const [errorMsg, setError]  = useState(null);

  /** Ref so event callbacks always see the latest socket without stale closure */
  const socketRef = useRef(null);

  // ── Disconnect helper ──────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setStatus("idle");
    setQrCode(null);
  }, []);

  // ── Connect & start session ────────────────────────────────────────────────
  const connect = useCallback(() => {
    // Prevent duplicate connections
    if (socketRef.current?.connected) return;

    setStatus("connecting");
    setQrCode(null);
    setError(null);

    const socket = io(BACKEND_URL, {
      query: { shopId },
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    // Transport connected → ask the server to (re)start the WA session
    socket.on("connect", () => {
      console.log("[socket] transport connected, starting session…");
      socket.emit("start_session");
    });

    // Server-side status updates
    socket.on("status", ({ status: s }) => {
      console.log("[socket] status →", s);
      setStatus(s);
      if (s === "connected") setQrCode(null);
    });

    // New QR string from Baileys
    socket.on("qr", ({ qr }) => {
      console.log("[socket] qr received");
      setQrCode(qr);
      setStatus("connecting");
    });

    // Server error
    socket.on("error", ({ message }) => {
      console.error("[socket] error →", message);
      setError(message);
      setStatus("error");
    });

    // Transport-level disconnect
    socket.on("disconnect", (reason) => {
      console.log("[socket] transport disconnected →", reason);
      // Only flip to "disconnected" if we were actively connected
      setStatus((prev) => (prev === "connected" ? "disconnected" : prev));
    });

    socket.on("connect_error", (err) => {
      console.error("[socket] connect_error →", err.message);
      setError("Cannot reach the backend server.");
      setStatus("error");
    });
  }, [shopId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return { status, qrCode, errorMsg, connect, disconnect };
}
