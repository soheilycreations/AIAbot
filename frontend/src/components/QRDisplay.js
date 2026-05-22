"use client";

import { QRCodeSVG } from "qrcode.react";
import { Loader2 } from "lucide-react";

/**
 * QRDisplay
 *
 * Shows one of three states:
 *  - waiting  → spinner while Baileys generates the first QR
 *  - qr ready → renders the QR code via qrcode.react
 *  - connected → success screen
 */
export function QRDisplay({ status, qrCode }) {
  // ── Connected ──────────────────────────────────────────────────────────────
  if (status === "connected") {
    return (
      <div className="flex flex-col items-center gap-3 animate-fade-in">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600/20 border border-brand-500/30">
          <svg className="h-8 w-8 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-brand-300">WhatsApp Connected!</p>
        <p className="text-xs text-slate-500 text-center max-w-[200px]">
          Your bot is live and listening for messages.
        </p>
      </div>
    );
  }

  // ── QR code received ───────────────────────────────────────────────────────
  if (qrCode) {
    return (
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        {/* White padding frame around QR (required for scanners) */}
        <div className="rounded-2xl bg-white p-4 shadow-2xl shadow-black/50 ring-1 ring-white/10">
          <QRCodeSVG
            value={qrCode}
            size={220}
            level="M"
            includeMargin={false}
            bgColor="#ffffff"
            fgColor="#0f172a"
          />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-slate-200">Scan with WhatsApp</p>
          <p className="text-xs text-slate-500">
            Open WhatsApp → Linked Devices → Link a Device
          </p>
        </div>
        <p className="text-[11px] text-yellow-600 animate-pulse-slow">
          QR expires in ~60 seconds — a new one will appear automatically
        </p>
      </div>
    );
  }

  // ── Waiting for QR (connecting) ────────────────────────────────────────────
  if (status === "connecting") {
    return (
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl glass">
          <Loader2 className="h-7 w-7 animate-spin text-brand-400" />
        </div>
        <p className="text-sm font-medium text-slate-300">Generating QR code…</p>
        <p className="text-xs text-slate-600">Connecting to WhatsApp servers</p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-3 text-orange-400">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-950/40 border border-orange-800/30">
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-orange-300">Connection failed</p>
        <p className="text-xs text-slate-500">Check that the backend server is running</p>
      </div>
    );
  }

  // ── Idle placeholder ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-3 text-slate-600">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl glass">
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 4v1m6.364 1.636l-.707.707M20 12h-1M17.657 17.657l-.707-.707M12 19v1M6.343 17.657l-.707.707M4 12H3M6.343 6.343l.707.707" />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-500">No active session</p>
      <p className="text-xs text-slate-600">Click "Generate QR Code" to begin</p>
    </div>
  );
}
