const { createScanJob } = require("./queue");

const demoJob = createScanJob({
  url: "https://example.com",
  crawlDepth: 1,
  pageLimit: 5,
  authMode: "public"
});

console.log("Synthetic worker booted.");
console.log(JSON.stringify(demoJob, null, 2));
