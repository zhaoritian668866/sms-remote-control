import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { initWebSocket } from "../wsManager";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import multer from "multer";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // MMS image upload endpoint (for Android client)
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
  app.post("/api/upload/mms-image", upload.single("file"), async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const ext = req.file.mimetype === "image/png" ? "png" : req.file.mimetype === "image/gif" ? "gif" : "jpg";
      const fileKey = `mms/received/${nanoid(16)}.${ext}`;
      const { url } = await storagePut(fileKey, req.file.buffer, req.file.mimetype);
      res.json({ url });
    } catch (e: any) {
      console.error("MMS image upload error:", e);
      res.status(500).json({ error: e.message || "Upload failed" });
    }
  });

  // APK download endpoint (redirect to S3)
  const APK_CDN_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663393087442/4rTHqCojuh9Vnb7GsHmjrf/sms-remote-v3.0_d640246d.zip";
  app.get("/api/download/apk", (_req: any, res: any) => {
    res.redirect(APK_CDN_URL);
  });

  // tRPC API (includes self-hosted auth routes)
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Initialize WebSocket server
  initWebSocket(server);

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
