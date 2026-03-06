import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { initWebSocket } from "../wsManager";
import { nanoid } from "nanoid";
import multer from "multer";

// Local uploads directory
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

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

/** Save file to local disk and return the public URL path */
export function saveFileLocally(buffer: Buffer, mimeType: string, subDir: string = ""): string {
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/gif" ? "gif" : "jpg";
  const fileName = `${nanoid(16)}.${ext}`;
  const dirPath = subDir ? path.join(UPLOADS_DIR, subDir) : UPLOADS_DIR;
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  const filePath = path.join(dirPath, fileName);
  fs.writeFileSync(filePath, buffer);
  // Return URL path (will be served by /uploads static route)
  return subDir ? `/uploads/${subDir}/${fileName}` : `/uploads/${fileName}`;
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Serve uploaded files as static assets
  app.use("/uploads", express.static(UPLOADS_DIR));

  // MMS image upload endpoint (for Android client)
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
  app.post("/api/upload/mms-image", upload.single("file"), async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const urlPath = saveFileLocally(req.file.buffer, req.file.mimetype, "mms");
      // Return full URL using request origin
      const origin = `${req.protocol}://${req.get("host")}`;
      res.json({ url: `${origin}${urlPath}` });
    } catch (e: any) {
      console.error("MMS image upload error:", e);
      res.status(500).json({ error: e.message || "Upload failed" });
    }
  });

  // App version info
  const APP_VERSION = "3.3.0";
  const APK_CDN_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663393087442/4rTHqCojuh9Vnb7GsHmjrf/sms-remote-v3.3.0_4b5c265c.zip";

  // Version check API (for auto-update)
  app.get("/api/app/version", (_req: any, res: any) => {
    res.json({
      version: APP_VERSION,
      downloadUrl: `${_req.protocol}://${_req.get("host")}/api/download/apk`,
      releaseNotes: "v3.3.0: 完全接管默认短信应用职责（收发短信写入系统数据库）、启动时弹出默认短信设置、连接后自动同步历史短信",
    });
  });

  // APK download endpoint (redirect to CDN)
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
