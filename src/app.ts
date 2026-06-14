import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes first
app.use("/api", router);

// Static frontend (production self-host: copy wolf-game dist/public here)
// When running `node dist/index.mjs`, __dirname is the dist/ directory.
// The build script copies the frontend build to dist/public/.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");

app.use(express.static(publicDir));

// SPA fallback — any non-API route serves index.html (Express 5 named wildcard)
app.get("/{*path}", (_req, res, next) => {
  res.sendFile(path.join(publicDir, "index.html"), (err) => {
    if (err) next(); // no frontend build present, skip silently
  });
});

export default app;
