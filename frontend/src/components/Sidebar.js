"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Bot, BookOpen, MessageSquare, Settings, Zap } from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard",      href: "/dashboard",           icon: LayoutDashboard },
  { label: "Connect Bot",    href: "/dashboard/connect",   icon: Bot },
  { label: "Knowledge Base", href: "/dashboard/knowledge", icon: BookOpen },
  { label: "Messages",       href: "/dashboard/messages",  icon: MessageSquare },
  { label: "Settings",       href: "/dashboard/settings",  icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 flex-shrink-0 flex-col border-r border-white/8 bg-surface-900">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/8">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-700 shadow-lg">
          <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-bold text-white tracking-tight">BotHive</p>
          <p className="text-[10px] text-slate-500 font-medium tracking-widest uppercase">Platform</p>
        </div>
      </div>

      <div className="mx-4 mt-4 mb-1 rounded-lg bg-white/5 border border-white/8 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Active Shop</p>
        <p className="text-sm font-semibold text-slate-200 font-mono">shop_123</p>
      </div>

      <nav className="mt-4 flex-1 px-3 space-y-0.5">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150
                ${active ? "bg-green-700/20 text-green-400" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}
            >
              <Icon className={`h-4 w-4 flex-shrink-0 ${active ? "text-green-400" : ""}`} />
              {label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-green-400" />}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 pb-5 pt-2 border-t border-white/8">
        <p className="text-[11px] text-slate-600 text-center">WhatsApp Bot Platform v1.0</p>
      </div>
    </aside>
  );
}
