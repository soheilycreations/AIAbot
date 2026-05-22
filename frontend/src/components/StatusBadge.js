"use client";

/**
 * StatusBadge
 * Renders a coloured pill reflecting the current WhatsApp connection state.
 */
export function StatusBadge({ status }) {
  const config = {
    idle: {
      dot: "bg-slate-400",
      pill: "bg-slate-800 text-slate-300 border-slate-700",
      label: "Idle",
      animate: false,
    },
    connecting: {
      dot: "bg-yellow-400",
      pill: "bg-yellow-950 text-yellow-300 border-yellow-800",
      label: "Connecting…",
      animate: true,
    },
    connected: {
      dot: "bg-brand-400",
      pill: "bg-brand-950/60 text-brand-300 border-brand-800",
      label: "Connected",
      animate: false,
    },
    disconnected: {
      dot: "bg-red-400",
      pill: "bg-red-950 text-red-300 border-red-800",
      label: "Disconnected",
      animate: false,
    },
    error: {
      dot: "bg-orange-400",
      pill: "bg-orange-950 text-orange-300 border-orange-800",
      label: "Error",
      animate: true,
    },
  };

  const c = config[status] ?? config.idle;

  return (
    <span className={`status-badge border ${c.pill}`}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${c.dot} ${c.animate ? "animate-pulse-slow" : ""}`}
      />
      {c.label}
    </span>
  );
}
