import { app } from "./app.js";

const hostArgIndex = process.argv.indexOf("--host");
const port = process.env.PORT ?? 4000;
const host = process.env.HOST ?? (hostArgIndex >= 0 ? process.argv[hostArgIndex + 1] : undefined) ?? "127.0.0.1";

app.listen(Number(port), host, () => {
  const displayHost = host === "0.0.0.0" || host === "127.0.0.1" ? "localhost" : host;
  console.log(`Backend listening on http://${displayHost}:${port}`);
});
