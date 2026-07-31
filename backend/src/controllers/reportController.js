const sharp = require("sharp");
const convexClient = require("../config/convex");
const { anyApi } = require("convex/server");
const { logEvent } = require("../middleware/logAudit");
const { notifyAdmin } = require("../services/adminNotification");
const { publish } = require("../services/notification");
const { uploadToCloudinary } = require("./uploadController");
const { v4: uuidv4 } = require("uuid");

const submitReport = async (req, res) => {
  try {
  const { name, phone, category, animalType, wildlifeCondition, location, description, latitude, longitude, quantity } = req.body;

  if (name && name.length > 100) {
    return res.status(400).json({ message: "Name must be at most 100 characters." });
  }
  if (!phone || !/^\+?\d{7,15}$/.test(phone)) {
    return res.status(400).json({ message: "Valid phone number is required (7-15 digits)." });
  }
  if (!animalType || animalType.length > 200) {
    return res.status(400).json({ message: "Animal type is required and must be at most 200 characters." });
  }
  if (!location || location.length > 500) {
    return res.status(400).json({ message: "Location is required and must be at most 500 characters." });
  }
  if (!description || description.length > 2000) {
    return res.status(400).json({ message: "Description is required and must be at most 2000 characters." });
  }

  const qty = quantity ? parseInt(quantity, 10) : undefined;
  if (qty !== undefined && (isNaN(qty) || qty < 1)) {
    return res.status(400).json({ message: "Quantity must be a positive number." });
  }

  const lat = latitude ? parseFloat(latitude) : undefined;
  const lng = longitude ? parseFloat(longitude) : undefined;

  const imagePublicIds = [];
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      try {
        const processed = await sharp(file.buffer)
          .resize({ width: 1920, withoutEnlargement: true })
          .jpeg({ quality: 80, mozjpeg: true })
          .toBuffer();
        const result = await uploadToCloudinary(processed, {
          folder: "resqbridge/images",
          public_id: uuidv4(),
          resource_type: "image",
          type: "authenticated",
        });
        imagePublicIds.push(result.public_id);
      } catch (err) {
        console.error("Image upload error:", err?.message || err);
      }
    }
  }

  const metadata = {
    name: name || "Anonymous",
    phone,
    category: category || "other",
    animalType,
    wildlifeCondition,
    location,
    description,
    images: imagePublicIds,
  };

  await logEvent({ req, eventType: "report_animal", metadata });

  const clientIp = req.ip || req.connection?.remoteAddress || "unknown";

  const reportId = await convexClient.mutation(anyApi.reports.insertReport, {
    name: name || "Anonymous",
    phone,
    category: category || "other",
    animalType,
    quantity: qty,
    location,
    description,
    images: imagePublicIds.length > 0 ? imagePublicIds.join(",") : undefined,
    latitude: lat,
    longitude: lng,
    status: "pending",
    reporterIp: clientIp,
  });

  await notifyAdmin({
    type: "new_report",
    message: `New ${animalType} report from ${name || "Anonymous"} at ${location}`,
    reportId,
    link: "/admin/dashboard/reports",
  });

  publish({ type: "report:new", reportId, animalType, location, name: name || "Anonymous" });

  res.status(201).json({ message: "Report submitted successfully.", imageCount: imagePublicIds.length });
} catch (err) {
  console.error("submitReport error:", err);
  res.status(500).json({ message: "Internal server error: " + err.message });
  }
};

module.exports = { submitReport };
