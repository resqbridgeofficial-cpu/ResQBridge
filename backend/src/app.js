const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const hpp = require("hpp");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const path = require("path");
const passport = require("passport");
require("./config/passport");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const reportRoutes = require("./routes/report");
const rescuerRoutes = require("./routes/rescuer");
const pushRoutes = require("./routes/push");
const { sendEmail } = require("./services/email");
const { globalLimiter, authLimiter, otpLimiter, adminLimiter } = require("./middleware/rateLimiter");
const { errorHandler, asyncHandler } = require("./middleware/errorHandler");
const { logEvent } = require("./middleware/logAudit");
const { authenticate, authorize } = require("./middleware/auth");
const { honeypot } = require("./middleware/honeypot");
const convexClient = require("./config/convex");
const { anyApi } = require("convex/server");
const { addSSEClient } = require("./services/notification");

const app = express();

app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://maps.googleapis.com", "https://maps.gstatic.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://maps.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://maps.gstatic.com", "https://maps.googleapis.com", "https://res.cloudinary.com"],
      connectSrc: ["'self'", "https://maps.googleapis.com"],
      frameSrc: ["'self'", "https://www.openstreetmap.org"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginResourcePolicy: { policy: "same-origin" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(cookieParser());
app.use(globalLimiter);
app.use(hpp());
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(passport.initialize());

app.get("/api/v1", (_req, res) => {
  res.json({ message: "ResQBridge API is running" });
});

app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({ status: "OK" });
});

const { getLandingConfig: publicLandingConfig } = require("./controllers/configController");

app.get("/api/v1/landing-config", asyncHandler(publicLandingConfig));

app.post("/api/v1/log/guest", async (req, res) => {
  const { section, duration, eventType } = req.body;
  try {
    await logEvent({
      req,
      eventType: eventType || "guest",
      section: section || "unknown",
      sessionDuration: duration || null,
    });
    res.json({ message: "Logged." });
  } catch { res.status(200).json({ message: "OK" }); }
});

app.post("/api/v1/log/logout", async (req, res) => {
  const token = req.cookies.token || (req.headers.authorization || "").split(" ")[1];
  let userId = null;
  if (token) {
    try { userId = jwt.verify(token, process.env.JWT_SECRET).uuid; } catch {}
  }
  res.clearCookie("token", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
  await logEvent({ req, userId, eventType: "logout" });
  res.json({ message: "Logged." });
});

app.post("/api/v1/contact", honeypot(), asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ message: "Name, email, and message are required." });
  }
  await logEvent({ req, eventType: "contact", section: "contact", metadata: { name, email, subject, message } });
  await sendEmail({
    to: "resqbridge.official@gmail.com",
    subject: `${subject || "Contact"} — ${name}`,
    html: `<h2>${subject || "Contact"} Submission</h2>
<p><strong>From:</strong> ${name} (${email})</p>
<p><strong>Subject:</strong> ${subject || "N/A"}</p>
<p><strong>Message:</strong></p>
<p>${message}</p>`,
    text: `${subject || "Contact"} Submission\n\nFrom: ${name} (${email})\nSubject: ${subject || "N/A"}\nMessage:\n${message}`,
  });
  res.json({ message: "Message sent successfully." });
}));

app.post("/api/v1/newsletter", honeypot(), asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }
  await logEvent({ req, eventType: "newsletter", section: "newsletter", metadata: { email } });
  res.json({ message: "Subscription successful." });
}));

app.get("/api/v1/auth/me", authenticate, asyncHandler(async (req, res) => {
  const user = await convexClient.query(anyApi.users.getUserByUuid, { uuid: req.user.uuid });
  if (!user) {
    res.clearCookie("token", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
    return res.status(401).json({ message: "User not found." });
  }
  const { password, ...safeUser } = user;
  res.json({ user: safeUser });
}));

app.get("/api/v1/report/updates", authenticate, (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
  addSSEClient(res);
});

app.use("/api/v1/auth", authLimiter, authRoutes);
app.use("/api/v1/admin", adminLimiter, adminRoutes);
app.use("/api/v1/report", reportRoutes);
app.use("/api/v1/rescuer", rescuerRoutes);
app.use("/api/v1/push", pushRoutes);

const { serveFile } = require("./controllers/uploadController");
const { serveMedia } = require("./controllers/mediaController");
app.get("/api/v1/files/:filename", authenticate, asyncHandler(serveFile));
app.get("/api/v1/public/files/:filename", asyncHandler(serveFile));
app.get("/api/v1/media/:publicId", authenticate, authorize("admin", "superadmin", "rescuer"), asyncHandler(serveMedia));

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use(errorHandler);

module.exports = app;
