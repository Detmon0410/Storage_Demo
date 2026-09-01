import "dotenv/config";
import cors from "cors";
import express from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiRoutes } from "./routes/index.js";

const app = express();
const port = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", apiRoutes);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
