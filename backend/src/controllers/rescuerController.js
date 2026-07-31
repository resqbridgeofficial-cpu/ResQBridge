const convexClient = require("../config/convex");
const { anyApi } = require("convex/server");
const { logEvent } = require("../middleware/logAudit");
const cloudinary = require("../config/cloudinary");
const { publish } = require("../services/notification");
const { sendReportStatus } = require("../services/email");
const { notifyAdmin } = require("../services/adminNotification");

function resolveImageUrls(imagesField) {
  if (!imagesField) return [];
  const items = typeof imagesField === "string" ? imagesField.split(",").filter(Boolean) : imagesField;
  return items.map((img) => {
    if (img.startsWith("http") || img.startsWith("/api/")) return img;
    return cloudinary.url(img, {
      type: "authenticated",
      sign_url: true,
      secure: true,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });
  });
}

const RESCUER_STATUS_MAP = {
  pending: "pending",
  assigned: "assigned",
  en_route: "en_route",
  in_progress: "in_progress",
  resolved: "resolved",
  failed: "failed",
};

async function logActivity(userId, action, details, reportId) {
  try {
    await convexClient.mutation(anyApi.activity.insertActivityLog, {
      userId,
      action,
      reportId: reportId || undefined,
      details,
    });
  } catch (err) {
    console.error("[ActivityLog] Failed to insert:", err.message);
  }
}

const getReports = async (req, res) => {
  const { status, assignedTo, search, sortBy } = req.query;
  const user = req.user;

  const queryArgs = {};
  if (assignedTo && user?.uuid) {
    queryArgs.assignedTo = user.uuid;
  }
  if (status) {
    const dbStatus = Object.keys(RESCUER_STATUS_MAP).find((k) => RESCUER_STATUS_MAP[k] === status) || status;
    queryArgs.status = dbStatus;
  }
  const reports = await convexClient.query(anyApi.reports.getReports, queryArgs);

  const mapped = reports.map((r) => ({
    _id: r._id,
    name: r.reporterEmail || "Anonymous",
    phone: r.phone || "",
    category: r.category || "other",
    animalType: r.animalName || r.animalType,
    location: r.location,
    description: r.description,
    images: r.images ? resolveImageUrls(r.images) : [],
    rescuerImages: r.rescuerImages ? resolveImageUrls(r.rescuerImages) : [],
    status: RESCUER_STATUS_MAP[r.status] || r.status,
    assignedTo: r.assignedTo || null,
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    createdAt: r.createdAt,
  }));

  let filtered = mapped;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q) ||
        r.animalType.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
    );
  }

  if (sortBy === "oldest") {
    filtered.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  } else {
    filtered.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }

  res.json({ reports: filtered });
};

const rejectAssignment = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.uuid;

  await convexClient.mutation(anyApi.reports.rejectAssignment, {
    reportId: id,
  });

  await logActivity(userId, "rejected", "Rejected assignment", id);

  res.json({ message: "Assignment rejected." });
};

const updateLocation = async (req, res) => {
  const userId = req.user.uuid;
  const { latitude, longitude } = req.body;

  if (latitude == null || longitude == null) {
    return res.status(400).json({ message: "Latitude and longitude are required." });
  }

  const user = await convexClient.query(anyApi.users.getUserByUuid, { uuid: userId });
  if (!user) return res.status(404).json({ message: "User not found." });
  const rescuerName = `${user.firstName} ${user.lastName}`.trim();

  await convexClient.mutation(anyApi.locations.updateRescuerLocation, {
    userId: user.uuid,
    userName: rescuerName,
    latitude,
    longitude,
  });

  res.json({ message: "Location updated." });
};

const updateReportStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const userId = req.user.uuid;

  if (!status) {
    return res.status(400).json({ message: "Status is required." });
  }

  await convexClient.mutation(anyApi.reports.updateReportStatus, {
    reportId: id,
    status,
  });

  publish({
    type: "report:status",
    reportId: id,
    userId,
    status,
  });

  const actionLabels = {
    en_route: "status:en_route",
    in_progress: "status:in_progress",
    resolved: "status:resolved",
    failed: "status:failed",
  };

  await logActivity(userId, actionLabels[status] || status, `Updated report status to ${status.replace('_', ' ')}`, id);

  res.json({ message: "Report status updated." });
};

const getStats = async (req, res) => {
  const userId = req.user.uuid;

  let reports = [];
  let activity = [];
  if (userId) {
    reports = await convexClient.query(anyApi.reports.getReports, { assignedTo: userId });
    activity = await convexClient.query(anyApi.activity.getActivityLogs, {
      userId,
      paginationOpts: { cursor: null, numItems: 200 },
    });
  }

  const total = reports.length;
  let pending = 0, accepted = 0, enRoute = 0, resolved = 0, failed = 0;
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthlyMap = {};
  const categoryMap = {};
  for (const r of reports) {
    if (r.status === 'pending') pending++
    else if (r.status === 'assigned') accepted++
    else if (r.status === 'en_route') enRoute++
    else if (r.status === 'resolved') resolved++
    else if (r.status === 'failed') failed++

    if (r.createdAt) {
      const d = new Date(r.createdAt)
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`
      if (!monthlyMap[key]) monthlyMap[key] = { month: key, assigned: 0, resolved: 0, failed: 0 }
      monthlyMap[key].assigned++
      if (r.status === 'resolved') monthlyMap[key].resolved++
      if (r.status === 'failed') monthlyMap[key].failed++
    }

    const cat = r.animalType || r.name || 'Unknown'
    categoryMap[cat] = (categoryMap[cat] || 0) + 1
  }
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const monthlyTrends = Object.values(monthlyMap).sort((a, b) => {
    const da = new Date(a.month)
    const db = new Date(b.month)
    return da - db
  });

  const categoryBreakdown = Object.entries(categoryMap)
    .map(([animal, count]) => ({ animal, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  let totalResponseTime = 0
  let responseTimeCount = 0
  const activityLogs = activity?.page || []
  const reportActivityMap = new Map()
  for (const a of activityLogs) {
    if (!a.reportId) continue
    if (!reportActivityMap.has(a.reportId)) reportActivityMap.set(a.reportId, [])
    reportActivityMap.get(a.reportId).push(a)
  }
  for (const entries of reportActivityMap.values()) {
    entries.sort((a, b) => (a._creationTime ?? 0) - (b._creationTime ?? 0))
    for (let i = 0; i < entries.length - 1; i++) {
      if (entries[i].action === 'status:en_route') {
        const next = entries[i + 1]
        if (next && entries[i]._creationTime && next._creationTime) {
          totalResponseTime += Math.abs(next._creationTime - entries[i]._creationTime)
          responseTimeCount++
        }
      }
    }
  }
  const avgResponseTime = responseTimeCount > 0 ? Math.round(totalResponseTime / responseTimeCount / 60000) : null

  const recentReports = reports.slice(0, 10).map((r) => ({
    _id: r._id,
    name: r.reporterEmail || "Anonymous",
    category: r.category || "other",
    animalType: r.animalName || r.animalType,
    status: RESCUER_STATUS_MAP[r.status] || r.status,
    location: r.location,
    createdAt: r.createdAt,
  }));

  res.json({
    totalAssigned: total,
    activeRequests: pending + accepted + enRoute,
    completed: resolved,
    pending,
    assigned: accepted,
    enRoute,
    inProgress: 0,
    resolved,
    failed,
    resolutionRate,
    avgResponseTime,
    monthlyTrends,
    categoryBreakdown,
    recentReports,
    availability: req.user?.availability || null,
  });
};

const updateProfile = async (req, res) => {
  const { firstName, lastName, phoneNumber, email, organization } = req.body;
  const userId = req.user.uuid;

  if (email) {
    const existing = await convexClient.query(anyApi.users.getUserByEmail, { email: email.toLowerCase().trim() });
    if (existing && existing.uuid !== userId) {
      return res.status(409).json({ message: "Email is already in use by another account." });
    }
  }

  await convexClient.mutation(anyApi.users.updateUser, {
    uuid: userId,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    phoneNumber: phoneNumber || undefined,
    email: email ? email.toLowerCase().trim() : undefined,
    organization: organization || undefined,
  });

  await logEvent({
    req,
    userId,
    eventType: "profile_update",
    metadata: { firstName, lastName, phoneNumber, email },
  });

  await logActivity(userId, "profile_update", `Updated profile${firstName ? ` (first name: ${firstName})` : ''}${lastName ? ` (last name: ${lastName})` : ''}`);

  const updated = await convexClient.query(anyApi.users.getUserByUuid, { uuid: userId });
  const { password, ...safeUser } = updated;
  res.json({ message: "Profile updated.", user: safeUser });
};

const getActivity = async (req, res) => {
  const userId = req.user.uuid;
  const cursor = req.query.cursor || null;
  const numItems = parseInt(req.query.limit, 10) || 20;
  const result = await convexClient.query(anyApi.activity.getActivityLogs, {
    userId,
    paginationOpts: { cursor, numItems },
  });
  res.json({ activity: result.page, continueCursor: result.continueCursor, isDone: result.isDone });
};

const updateAvailability = async (req, res) => {
  const userId = req.user.uuid;
  const { availability } = req.body;

  if (!["available", "busy"].includes(availability)) {
    return res.status(400).json({ message: "Invalid availability value." });
  }

  await convexClient.mutation(anyApi.users.updateAvailability, {
    uuid: userId,
    availability,
  });

  await logActivity(userId, "availability", `Set status to ${availability}`);

  res.json({ message: `You are now marked as ${availability}.`, availability });
};

const addNote = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.uuid;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ message: "Note content is required." });
  }

  const user = await convexClient.query(anyApi.users.getUserByUuid, { uuid: userId });
  const userName = user ? `${user.firstName} ${user.lastName}` : userId;

  await convexClient.mutation(anyApi.notes.addReportNote, {
    reportId: id,
    userId,
    userName,
    content: content.trim(),
  });

  res.json({ message: "Note added." });
};

const getNotes = async (req, res) => {
  const { id } = req.params;
  const notes = await convexClient.query(anyApi.notes.getReportNotes, {
    reportId: id,
  });
  res.json({ notes });
};

const removeImage = async (req, res) => {
  const { id } = req.params;
  const { imageUrl } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ message: "imageUrl is required." });
  }

  const report = await convexClient.query(anyApi.reports.getReport, { reportId: id });
  if (!report) {
    return res.status(404).json({ message: "Report not found." });
  }

  const target = imageUrl.startsWith('http') ? imageUrl.replace(/^https?:\/\/[^\/]+\/image\/authenticated\/[^\/]+\/v1\//, '') : imageUrl;

  const existing = report.rescuerImages ? report.rescuerImages.split(",").filter(Boolean) : [];
  const filtered = existing.filter((img) => img !== imageUrl && img !== target);
  await convexClient.mutation(anyApi.reports.updateReportRescuerImages, {
    reportId: id,
    rescuerImages: filtered.join(","),
  });

  res.json({ message: "Image removed." });
};

const saveImages = async (req, res) => {
  const { id } = req.params;
  const { images } = req.body;

  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ message: "images array is required." });
  }

  const report = await convexClient.query(anyApi.reports.getReport, { reportId: id });
  if (!report) {
    return res.status(404).json({ message: "Report not found." });
  }

  const existing = report.rescuerImages ? report.rescuerImages.split(",").filter(Boolean) : [];
  const merged = [...existing, ...images];
  const stored = merged.join(",");
  await convexClient.mutation(anyApi.reports.updateReportRescuerImages, {
    reportId: id,
    rescuerImages: stored,
  });

  publish({
    type: "report:images",
    reportId: id,
  });

  res.json({ message: "Images saved." });
};

const getNotifications = async (req, res) => {
  const userId = req.user.uuid;
  const limit = parseInt(req.query.limit, 10) || 50;
  const notifications = await convexClient.query(anyApi.rescuerNotifications.getNotifications, {
    userId,
    limit,
  });
  const unreadCount = await convexClient.query(anyApi.rescuerNotifications.getUnreadCount, {
    userId,
  });
  res.json({ notifications, unreadCount });
};

const markAllNotificationsRead = async (req, res) => {
  const userId = req.user.uuid;
  await convexClient.mutation(anyApi.rescuerNotifications.markAllAsRead, { userId });
  res.json({ message: "All notifications marked as read." });
};

const markNotificationRead = async (req, res) => {
  const { id } = req.params;
  await convexClient.mutation(anyApi.rescuerNotifications.markAsRead, { id });
  res.json({ message: "Notification marked as read." });
};

module.exports = {
  getReports,
  updateReportStatus,
  getStats,
  updateProfile,
  getActivity,
  updateAvailability,
  addNote,
  getNotes,
  saveImages,
  removeImage,
  updateLocation,
  rejectAssignment,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
};
