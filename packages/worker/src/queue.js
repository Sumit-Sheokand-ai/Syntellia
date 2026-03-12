function createScanJob(input) {
  return {
    type: "scan.requested",
    createdAt: new Date().toISOString(),
    payload: input
  };
}

module.exports = {
  createScanJob
};
