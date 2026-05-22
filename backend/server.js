const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { createSession, destroySession } = require("./whatsappManager");
const faqRoutes = require("./faqRoutes");
const shopRoutes = require("./shopRoutes");
const docRoutes = require("./docRoutes");
const settingsRoutes = require("./settingsRoutes");
const statsRoutes = require("./statsRoutes");
const aiRoutes = require("./aiRoutes");
const authRoutes = require("./authRoutes");

const PORT = process.env.PORT || 5000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

const app = express();
app.use(cors({ origin: FRONTEND_ORIGIN, methods: ["GET","POST","PATCH","DELETE"] }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/faqs", faqRoutes);
app.use("/api/docs", docRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", shopRoutes);

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: FRONTEND_ORIGIN, methods: ["GET","POST"] },
  pingTimeout: 60000,
});

io.on("connection", (socket) => {
  const shopId = socket.handshake.query?.shopId;
  if (!shopId) { socket.disconnect(true); return; }

  console.log(`[${shopId}] Client connected`);

  socket.on("start_session", async () => {
    try {
      socket.emit("status", { status: "connecting" });
      await createSession(shopId, socket);
    } catch (err) {
      socket.emit("error", { message: "Failed to start WhatsApp session" });
    }
  });

  socket.on("disconnect_session", async () => {
    await destroySession(shopId);
    socket.emit("status", { status: "disconnected" });
  });

  socket.on("disconnect", (reason) => {
    console.log(`[${shopId}] Socket disconnected (${reason})`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`\n🚀  WhatsApp Bot Backend running`);
  console.log(`   HTTP  →  http://localhost:${PORT}`);
  console.log(`   CORS  →  ${FRONTEND_ORIGIN}\n`);
});

process.on("SIGTERM", () => httpServer.close(() => process.exit(0)));
