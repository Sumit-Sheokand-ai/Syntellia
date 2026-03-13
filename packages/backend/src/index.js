const express = require("express");
const cors = require("cors");
const { scanRouter } = require("./scan-router");

const app = express();
const PORT = process.env.PORT || 3001;

// Allow requests from the GitHub Pages frontend, or wildcard in dev.
// Set ALLOWED_ORIGIN=https://your-org.github.io on Render.
const rawOrigin = process.env.ALLOWED_ORIGIN ?? "*";
const allowedOrigins = rawOrigin === "*" ? "*" : rawOrigin.split(",").map((s) => s.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: allowedOrigins !== "*"
  })
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "syntellia-backend", ts: new Date().toISOString() });
});

app.use("/api", scanRouter);

app.listen(PORT, () => {
  console.log(`Syntellia backend listening on port ${PORT}`);
});
