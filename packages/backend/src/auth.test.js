const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildAuthContext,
  normalizeRole,
  requireRoles,
  resolvePrimaryRole,
  resolveUserRoles
} = require("./auth");

function createMockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

test("normalizeRole lowercases and normalizes spaces/hyphens", () => {
  assert.equal(normalizeRole(" Admin "), "admin");
  assert.equal(normalizeRole("billing-admin"), "billing_admin");
  assert.equal(normalizeRole("security team"), "security_team");
  assert.equal(normalizeRole(null), "");
});

test("resolveUserRoles pulls claims from metadata and falls back to member", () => {
  assert.deepEqual(
    resolveUserRoles({
      app_metadata: { roles: ["Admin", "ops"] }
    }),
    ["admin", "ops"]
  );
  assert.deepEqual(
    resolveUserRoles({
      app_metadata: {},
      user_metadata: { role: "Security" }
    }),
    ["security"]
  );
  assert.deepEqual(resolveUserRoles({ app_metadata: {}, user_metadata: {} }), ["member"]);
});

test("resolvePrimaryRole follows precedence and buildAuthContext exposes actor fields", () => {
  assert.equal(resolvePrimaryRole(["member", "ops"]), "ops");
  assert.equal(resolvePrimaryRole(["member", "custom_role"]), "member");

  const context = buildAuthContext({
    id: "user-123",
    app_metadata: { roles: ["member", "admin"] }
  });

  assert.equal(context.userId, "user-123");
  assert.deepEqual(context.roles, ["member", "admin"]);
  assert.equal(context.primaryRole, "admin");
});

test("requireRoles blocks requests when user is missing", () => {
  const middleware = requireRoles(["admin"]);
  const req = {
    user: null,
    requestId: "req-1",
    traceId: "trace-1"
  };
  const res = createMockResponse();

  let calledNext = false;
  middleware(req, res, () => {
    calledNext = true;
  });

  assert.equal(calledNext, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, "UNAUTHORIZED");
});

test("requireRoles denies users without allowed role and allows matching roles", () => {
  const middleware = requireRoles(["admin", "ops"]);
  const deniedReq = {
    user: { id: "user-1" },
    authContext: {
      userId: "user-1",
      roles: ["member"],
      primaryRole: "member"
    },
    originalUrl: "/api/admin/analytics/events",
    method: "GET",
    requestId: "req-denied",
    traceId: "trace-denied"
  };
  const deniedRes = createMockResponse();

  let deniedNextCalled = false;
  middleware(deniedReq, deniedRes, () => {
    deniedNextCalled = true;
  });

  assert.equal(deniedNextCalled, false);
  assert.equal(deniedRes.statusCode, 403);
  assert.equal(deniedRes.body.code, "INSUFFICIENT_ROLE");
  assert.deepEqual(deniedRes.body.requiredRoles.sort(), ["admin", "ops"]);

  const allowedReq = {
    user: { id: "user-2" },
    authContext: {
      userId: "user-2",
      roles: ["ops", "member"],
      primaryRole: "ops"
    },
    originalUrl: "/api/admin/analytics/events",
    method: "GET",
    requestId: "req-allowed",
    traceId: "trace-allowed"
  };
  const allowedRes = createMockResponse();

  let allowedNextCalled = false;
  middleware(allowedReq, allowedRes, () => {
    allowedNextCalled = true;
  });

  assert.equal(allowedNextCalled, true);
  assert.equal(allowedRes.statusCode, 200);
  assert.equal(allowedRes.body, null);
});
