const jwt = require("jsonwebtoken");
const { logEvent } = require("../middleware/logAudit");

function ssoCallback(req, res) {
  const user = req.user;
  if (!user) {
    return res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/v1/login?error=sso_failed`);
  }

  const token = jwt.sign(
    { uuid: user.uuid, email: user.email, role: user.role },
    process.env.JWT_SECRET,
  );

  logEvent({
    req,
    userId: user.uuid,
    eventType: user.isNew ? "sso_register" : "sso_login",
    metadata: { email: user.email, provider: "google" },
  });

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  res.redirect(`${frontendUrl}/v1/login?sso=success`);
}

module.exports = { ssoCallback };
