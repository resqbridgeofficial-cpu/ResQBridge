const express = require("express");
const { body, param } = require("express-validator");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { asyncHandler } = require("../middleware/errorHandler");
const {
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
} = require("../controllers/rescuerController");
const { upload, uploadImage } = require("../controllers/uploadController");
const { getShifts, saveShifts } = require("../controllers/shiftController");
const { getChecklist, saveChecklist } = require("../controllers/equipmentController");


router.use(authenticate);
router.use(authorize("rescuer", "admin", "superadmin"));

const reportIdParam = param("id").trim().notEmpty().withMessage("Report ID is required.");
const reportIdQuery = param("reportId").trim().notEmpty().withMessage("Report ID is required.");

router.get("/reports", asyncHandler(getReports));
router.patch("/reports/:id/status", reportIdParam, validate, asyncHandler(updateReportStatus));
router.get("/reports/:id/notes", reportIdParam, validate, asyncHandler(getNotes));
router.post("/reports/:id/notes", reportIdParam, validate, asyncHandler(addNote));
router.get("/stats", asyncHandler(getStats));
const profileRules = [
  body("firstName").optional().trim().isLength({ max: 50 }).matches(/^[a-zA-Z\s'-]+$/).withMessage("First name contains invalid characters."),
  body("lastName").optional().trim().isLength({ max: 50 }).matches(/^[a-zA-Z\s'-]+$/).withMessage("Last name contains invalid characters."),
  body("phoneNumber").trim().notEmpty().withMessage("Phone number is required.").matches(/^\+?\d{7,15}$/).withMessage("Valid phone number is required (7-15 digits)."),
  body("email").optional().trim().isEmail().normalizeEmail().withMessage("Valid email is required."),
];
router.patch("/profile", profileRules, validate, asyncHandler(updateProfile));
router.get("/activity", asyncHandler(getActivity));
router.patch("/availability", asyncHandler(updateAvailability));
router.post("/location", asyncHandler(updateLocation));
router.post("/reports/:id/reject", reportIdParam, validate, asyncHandler(rejectAssignment));
router.post("/reports/:id/images", reportIdParam, validate, asyncHandler(saveImages));
router.delete("/reports/:id/images", reportIdParam, validate, asyncHandler(removeImage));
router.post("/upload", upload.single("image"), asyncHandler(uploadImage));
router.get("/notifications", asyncHandler(getNotifications));
router.post("/notifications/read-all", asyncHandler(markAllNotificationsRead));
router.patch("/notifications/:id/read", asyncHandler(markNotificationRead));

router.get("/shifts", asyncHandler(getShifts));
router.post("/shifts", asyncHandler(saveShifts));
router.get("/reports/:reportId/checklist", reportIdQuery, validate, asyncHandler(getChecklist));
router.post("/reports/:reportId/checklist", reportIdQuery, validate, asyncHandler(saveChecklist));
router.get("/locations", asyncHandler(async (_req, res) => {
  const convexClient = require("../config/convex");
  const { anyApi } = require("convex/server");
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
}));

module.exports = router;
