import "dotenv/config";
import cors from "cors";
import express from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiRoutes } from "./routes/index.js";

const app = express();
const hostArgIndex = process.argv.indexOf("--host");
const port = process.env.PORT ?? 4000;
const host = process.env.HOST ?? (hostArgIndex >= 0 ? process.argv[hostArgIndex + 1] : undefined) ?? "127.0.0.1";

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", apiRoutes);

app.use(errorHandler);

app.listen(Number(port), host, () => {
  const displayHost = host === "0.0.0.0" || host === "127.0.0.1" ? "localhost" : host;
  console.log(`Backend listening on http://${displayHost}:${port}`);
});
