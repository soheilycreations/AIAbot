import { Sidebar } from "@/components/Sidebar";

export const metadata = {
  title: "Dashboard — BotHive",
};

export default function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface-950">
      <Sidebar />

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto">
        {/* Subtle grid background */}
        <div
          className="min-h-full"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
