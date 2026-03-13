const { Router } = require("express");
const { requireAuth } = require("./auth");
const { createScan, getScan, listScans } = require("./scan-store");

const scanRouter = Router();

scanRouter.get("/scans", requireAuth, async (req, res) => {
  try {
    const scans = await listScans(req.user.id);
    res.json({ scans });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

scanRouter.post("/scans", requireAuth, async (req, res) => {
  const { url, scanSize, loginMode, focusArea } = req.body;

  if (!url) {
    return res.status(400).json({ error: "Please add a full page link." });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: "Please use a full link that starts with http:// or https://." });
  }

  try {
    const scan = await createScan(req.user.id, {
      url,
      scanSize: scanSize ?? "Standard review",
      loginMode: loginMode ?? "No login needed",
      focusArea: focusArea ?? "Overall feel"
    });
    res.status(201).json(scan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

scanRouter.get("/scans/:scanId", requireAuth, async (req, res) => {
  try {
    const scan = await getScan(req.user.id, req.params.scanId);
    if (!scan) return res.status(404).json({ error: "Scan not found." });
    res.json(scan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = { scanRouter };
