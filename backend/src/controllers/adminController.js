const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const convexClient = require("../config/convex");
const { anyApi } = require("convex/server");
const { logEvent } = require("../middleware/logAudit");
const { AppError } = require("../middleware/errorHandler");
const { notifyAdmin } = require("../services/adminNotification");
const { publish } = require("../services/notification");
const cloudinary = require("../config/cloudinary");

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

const getUsers = async (_req, res) => {
  const users = await convexClient.query(anyApi.users.getAllUsers);
  const filtered = users.filter((u) => u.role !== "superadmin");
  const sanitized = filtered.map((u) => ({
    uuid: u.uuid,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    phoneNumber: u.phoneNumber,
    role: u.role,
    organization: u.organization || null,
  }));
  res.json({ users: sanitized });
};

const getUser = async (req, res) => {
  const user = await convexClient.query(anyApi.users.getUserByUuid, { uuid: req.params.uuid });
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }
  res.json({
    user: {
      uuid: user.uuid,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      organization: user.organization || null,
    },
  });
};

const updateUserRole = async (req, res) => {
  const { uuid } = req.params;
  const { role } = req.body;

  const validRoles = ["superadmin", "admin", "rescuer"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
  }

  const user = await convexClient.query(anyApi.users.getUserByUuid, { uuid });
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const allUsers = await convexClient.query(anyApi.users.getAllUsers);
  const superadminCount = allUsers.filter((u) => u.role === "superadmin").length;

  if (role === "superadmin") {
    if (superadminCount >= 1 && user.role !== "superadmin") {
      return res.status(400).json({ message: "A superadmin already exists. Only one superadmin is allowed." });
    }
  }

  if (user.role === "superadmin" && role !== "superadmin" && superadminCount <= 1) {
    return res.status(400).json({ message: "Cannot demote the only superadmin. Promote another user first." });
  }

  if (req.user.role !== "superadmin" && uuid === req.user.uuid) {
    return res.status(403).json({ message: "You cannot change your own role." });
  }

  await convexClient.mutation(anyApi.users.updateUserRole, { uuid, role });

  await logEvent({ req, userId: req.user.uuid, eventType: "role_change", metadata: { targetUuid: uuid, oldRole: user.role, newRole: role } });

  res.json({ message: "User role updated successfully." });
};

const createUser = async (req, res) => {
  const { firstName, lastName, email, phoneNumber, password } = req.body;

  if (!firstName || !lastName || !email || !phoneNumber || !password) {
    return res.status(400).json({ message: "firstName, lastName, email, phoneNumber, and password are required." });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await convexClient.query(anyApi.users.getUserByEmail, { email: normalizedEmail });
  if (existingUser) {
    return res.status(409).json({ message: "A user with this email already exists." });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const userUuid = uuidv4();

  await convexClient.mutation(anyApi.users.createUser, {
    uuid: userUuid,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    phoneNumber,
    email: normalizedEmail,
    password: hashedPassword,
    role: "rescuer",
    organization: req.body.organization || undefined,
  });

  await logEvent({ req, userId: req.user.uuid, eventType: "admin_create_user", metadata: { targetEmail: normalizedEmail, role: "rescuer" } });

  res.status(201).json({ message: "Rescuer account created successfully.", user: { uuid: userUuid, firstName, lastName, email: normalizedEmail, role: "rescuer" } });
};

const STATUS_MAP = {
  pending: "pending",
  assigned: "assigned",
  en_route: "en_route",
  in_progress: "in_progress",
  resolved: "resolved",
  failed: "failed",
};

const getAdminReports = async (req, res) => {
  const reports = await convexClient.query(anyApi.reports.listReports);
  const mapped = reports.map((r) => ({
    _id: r._id,
    name: r.reporterEmail || "Anonymous",
    phone: r.phone || "",
    category: r.category || "other",
    animalType: r.animalName || r.animalType,
    quantity: r.quantity ?? null,
    location: r.location,
    description: r.description,
    images: r.images ? resolveImageUrls(r.images) : [],
    rescuerImages: r.rescuerImages ? resolveImageUrls(r.rescuerImages) : [],
    status: STATUS_MAP[r.status] || r.status,
    assignedTo: r.assignedRescuerEmail || r.assignedTo || null,
    assignedUser: r.assignedUser || null,
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    createdAt: r.createdAt,
  }));
  res.json({ reports: mapped });
};

const assignReport = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ message: "userId is required." });
  }
  await convexClient.mutation(anyApi.reports.assignReport, {
    reportId: id,
    userId,
  });

  const user = await convexClient.query(anyApi.users.getUserByUuid, { uuid: userId });
  const assignedByName = user ? `${user.firstName} ${user.lastName}`.trim() : "a rescuer";

  await convexClient.mutation(anyApi.rescuerNotifications.insertNotification, {
    userId,
    reportId: id,
    type: "assignment",
    message: `New report assigned to you`,
  });

  publish({
    type: "report:claimed",
    userId,
    reportId: id,
    assignedByName,
  });

  res.json({ message: "Report assigned." });
};

const getRescuerLocations = async (_req, res) => {
  const [locations, users] = await Promise.all([
    convexClient.query(anyApi.locations.getRescuerLocations),
    convexClient.query(anyApi.users.getAllUsers),
  ]);
  const nameMap = {};
  for (const u of users) {
    nameMap[u.uuid] = `${u.firstName} ${u.lastName}`.trim();
  }
  const enriched = locations.map((l) => ({
    ...l,
    userName: nameMap[l.userId] || l.userName,
  }));
  res.json({ locations: enriched });
};

const getRescuerReports = async (req, res) => {
  const { uuid } = req.params;
  const reports = await convexClient.query(anyApi.reports.getReports, { assignedTo: uuid });
  const mapped = reports.map((r) => ({
    _id: r._id,
    name: r.name,
    phone: r.phone,
    category: r.category,
    animalType: r.animalType,
    location: r.location,
    description: r.description,
    latitude: r.latitude,
    longitude: r.longitude,
    status: r.status,
    assignedTo: r.assignedTo,
    assignedUser: r.assignedUser,
    createdAt: r.createdAt,
  }));
  res.json({ reports: mapped });
};

const archiveReport = async (req, res) => {
  const { id } = req.params;
  await convexClient.mutation(anyApi.reports.archiveReports, {
    reportIds: [id],
    archivedBy: req.user.uuid,
  });
  res.json({ message: "Report archived." });
};

const bulkArchiveReports = async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: "ids array is required." });
  }
  await convexClient.mutation(anyApi.reports.archiveReports, {
    reportIds: ids,
    archivedBy: req.user.uuid,
  });
  res.json({ message: `${ids.length} report(s) archived.` });
};

const unarchiveReport = async (req, res) => {
  const { id } = req.params;
  await convexClient.mutation(anyApi.reports.unarchiveReport, {
    reportId: id,
  });
  res.json({ message: "Report unarchived." });
};

const getArchivedReports = async (_req, res) => {
  res.json({ reports: [] });
};

const deleteReport = async (req, res) => {
  const { id } = req.params;
  await convexClient.mutation(anyApi.reports.deleteReport, {
    reportId: id,
  });
  res.json({ message: "Report deleted." });
};

const getStats = async (_req, res) => {
  const users = await convexClient.query(anyApi.users.getAllUsers);
  const filtered = users.filter((u) => u.role !== "superadmin");
  const totalUsers = filtered.length;
  const roleCounts = { admin: 0, rescuer: 0, user: 0 };
  for (const u of filtered) {
    if (roleCounts[u.role] !== undefined) roleCounts[u.role]++;
  }
  res.json({ stats: { totalUsers, roleCounts } });
};

const updatePassword = async (req, res) => {
  const { uuid } = req.params;
  const { password, currentPassword } = req.body;

  if (!password || password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters." });
  }

  const user = await convexClient.query(anyApi.users.getUserByUuid, { uuid });
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  if (uuid === req.user.uuid) {
    if (!currentPassword) {
      return res.status(400).json({ message: "Current password is required to change your own password." });
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  await convexClient.mutation(anyApi.users.updatePassword, { uuid, password: hashedPassword });

  await logEvent({ req, userId: req.user.uuid, eventType: "admin_update_password", metadata: { targetUuid: uuid } });

  res.json({ message: "Password updated successfully." });
};

const getReportNotes = async (req, res) => {
  const { id } = req.params;
  const notes = await convexClient.query(anyApi.notes.getReportNotes, {
    reportId: id,
  });
  res.json({ notes });
};

const updateAdminProfile = async (req, res) => {
  const { firstName, lastName, phoneNumber, email } = req.body;
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
  });

  await logEvent({
    req,
    userId,
    eventType: "profile_update",
    metadata: { firstName, lastName, phoneNumber, email },
  });

  const updated = await convexClient.query(anyApi.users.getUserByUuid, { uuid: userId });
  const { password, ...safeUser } = updated;
  res.json({ message: "Profile updated.", user: safeUser });
};

module.exports = { getUsers, getUser, updateUserRole, createUser, getStats, getAdminReports, assignReport, getRescuerLocations, getRescuerReports, archiveReport, bulkArchiveReports, unarchiveReport, getArchivedReports, deleteReport, updatePassword, updateAdminProfile, getReportNotes };
