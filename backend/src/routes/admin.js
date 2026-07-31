const express = require("express");
const { body, param } = require("express-validator");
const router = express.Router();
const { authenticate, authorize, authorizeWithPermission } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { asyncHandler } = require("../middleware/errorHandler");
const { getUsers, getUser, updateUserRole, createUser, updatePassword, getStats, getAdminReports, assignReport, getRescuerLocations, getRescuerReports, archiveReport, bulkArchiveReports, unarchiveReport, getArchivedReports, deleteReport, updateAdminProfile, getReportNotes } = require("../controllers/adminController");
const { getLogs, getLogStats, getLogsByIP, deleteOldLogs } = require("../controllers/logController");
const { getDashboardData } = require("../controllers/dashboardController");
const { getConfig, updateConfig, getLandingConfig, updateLandingConfig } = require("../controllers/configController");
const { getAdminPermissions, updateAdminPermissions } = require("../controllers/permissionsController");
const { getNotifications, getUnreadCount, markAsRead, markAllAsRead } = require("../controllers/adminNotificationController");
const { exportReports, exportUsers, exportLogs } = require("../controllers/exportController");
const { getHealth } = require("../controllers/healthController");
router.use(authenticate);

const adminOnly = authorize("superadmin", "admin");
const superOnly = authorize("superadmin");

const uuidParam = param("uuid").trim().isUUID().withMessage("Valid UUID is required.");
const reportIdParam = param("id").trim().notEmpty().withMessage("Report ID is required.");
const ipParam = param("ip").trim().isIP().withMessage("Valid IP address is required.");

router.get("/dashboard", authorizeWithPermission("dashboard"), asyncHandler(getDashboardData));

router.get("/users", authorizeWithPermission("users"), asyncHandler(getUsers));
router.get("/users/:uuid", authorizeWithPermission("users"), uuidParam, validate, asyncHandler(getUser));
router.get("/stats", adminOnly, asyncHandler(getStats));

const updateRoleRules = [
  body("role").trim().notEmpty().withMessage("Role is required."),
];
router.patch("/users/:uuid/role", authorizeWithPermission("users", "write"), uuidParam, updateRoleRules, validate, asyncHandler(updateUserRole));

const updatePasswordRules = [
  body("password").trim().isLength({ min: 8 }).withMessage("Password must be at least 8 characters."),
  body("currentPassword").optional({ values: "falsy" }).trim(),
];
router.patch("/users/:uuid/password", authorizeWithPermission("users", "write"), uuidParam, updatePasswordRules, validate, asyncHandler(updatePassword));

const createUserRules = [
  body("firstName").trim().notEmpty().isLength({ max: 50 }).matches(/^[a-zA-Z\s'-]+$/).withMessage("Invalid first name."),
  body("lastName").trim().notEmpty().isLength({ max: 50 }).matches(/^[a-zA-Z\s'-]+$/).withMessage("Invalid last name."),
  body("email").trim().normalizeEmail().isEmail().withMessage("Valid email is required."),
  body("phoneNumber").trim().notEmpty().matches(/^\+?\d{7,15}$/).withMessage("Valid phone number is required."),
  body("password").trim().isLength({ min: 8 }).withMessage("Password must be at least 8 characters."),
  body("organization").trim().notEmpty().withMessage("Organization is required."),
];
router.post("/users/create", authorizeWithPermission("users", "write"), createUserRules, validate, asyncHandler(createUser));

router.get("/logs", authorizeWithPermission("audit"), asyncHandler(getLogs));
router.get("/logs/stats", authorizeWithPermission("audit"), asyncHandler(getLogStats));
router.get("/logs/ip/:ip", authorizeWithPermission("audit"), ipParam, validate, asyncHandler(getLogsByIP));
router.post("/logs/cleanup", authorizeWithPermission("audit", "execute"), asyncHandler(deleteOldLogs));

router.get("/config", authorizeWithPermission("systemConfig"), asyncHandler(getConfig));
router.put("/config", authorizeWithPermission("systemConfig", "write"), asyncHandler(updateConfig));

router.get("/landing-config", authorizeWithPermission("landingPage"), asyncHandler(getLandingConfig));
router.put("/landing-config", authorizeWithPermission("landingPage", "write"), asyncHandler(updateLandingConfig));

router.get("/permissions", adminOnly, asyncHandler(getAdminPermissions));
router.put("/permissions", superOnly, asyncHandler(updateAdminPermissions));

router.get("/reports", authorizeWithPermission("reports"), asyncHandler(getAdminReports));
router.post("/reports/:id/assign", authorizeWithPermission("reports", "execute"), reportIdParam, validate, asyncHandler(assignReport));
router.put("/reports/:id/archive", authorizeWithPermission("reports", "execute"), reportIdParam, validate, asyncHandler(archiveReport));
router.post("/reports/bulk/archive", authorizeWithPermission("reports", "execute"), asyncHandler(bulkArchiveReports));
router.get("/reports/archived", authorizeWithPermission("archive"), asyncHandler(getArchivedReports));
router.post("/reports/:id/unarchive", authorizeWithPermission("archive", "write"), reportIdParam, validate, asyncHandler(unarchiveReport));
router.delete("/reports/:id", authorizeWithPermission("archive", "execute"), reportIdParam, validate, asyncHandler(deleteReport));
router.get("/reports/:id/notes", authorizeWithPermission("reports"), reportIdParam, validate, asyncHandler(getReportNotes));
router.get("/rescuer-locations", authorizeWithPermission("rescuerMap"), asyncHandler(getRescuerLocations));
router.get("/rescuers/:uuid/reports", authorizeWithPermission("rescuerMap"), uuidParam, validate, asyncHandler(getRescuerReports));

router.get("/export/reports", authorizeWithPermission("exportData"), asyncHandler(exportReports));
router.get("/export/users", authorizeWithPermission("exportData"), asyncHandler(exportUsers));
router.get("/export/logs", authorizeWithPermission("exportData"), asyncHandler(exportLogs));

router.get("/health", authorizeWithPermission("systemHealth"), asyncHandler(getHealth));

const profileRules = [
  body("firstName").optional().trim().isLength({ max: 50 }).matches(/^[a-zA-Z\s'-]+$/).withMessage("First name contains invalid characters."),
  body("lastName").optional().trim().isLength({ max: 50 }).matches(/^[a-zA-Z\s'-]+$/).withMessage("Last name contains invalid characters."),
  body("phoneNumber").trim().notEmpty().withMessage("Phone number is required.").matches(/^\+?\d{7,15}$/).withMessage("Valid phone number is required (7-15 digits)."),
  body("email").optional().trim().isEmail().normalizeEmail().withMessage("Valid email is required."),
];
router.patch("/profile", adminOnly, profileRules, validate, asyncHandler(updateAdminProfile));

router.get("/notifications", asyncHandler(getNotifications));
router.get("/notifications/unread-count", asyncHandler(getUnreadCount));
router.patch("/notifications/:id/read", asyncHandler(markAsRead));
router.post("/notifications/read-all", asyncHandler(markAllAsRead));

const { upload, uploadImage } = require("../controllers/uploadController");
router.post("/upload", adminOnly, upload.single("image"), asyncHandler(uploadImage));

module.exports = router;
