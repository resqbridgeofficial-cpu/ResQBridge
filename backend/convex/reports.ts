import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const reportStatus = v.union(
  v.literal("pending"),
  v.literal("assigned"),
  v.literal("en_route"),
  v.literal("in_progress"),
  v.literal("resolved"),
  v.literal("failed"),
);

export const listReportsByRescuer = query({
  args: { rescuerEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.rescuerEmail))
      .first();
    if (!user) return [];
    return await ctx.db
      .query("reports")
      .withIndex("by_assignedTo", (q) => q.eq("assignedTo", user.uuid))
      .order("desc")
      .collect();
  },
});

export const listReports = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("reports").order("desc").take(200);
  },
});

export const getReport = query({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.reportId);
  },
});

export const createReport = mutation({
  args: {
    animalName: v.string(),
    location: v.string(),
    description: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    reporterEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const reportId = await ctx.db.insert("reports", {
      name: args.animalName,
      phone: "",
      category: "other",
      animalType: args.animalName,
      location: args.location,
      description: args.description,
      latitude: args.latitude,
      longitude: args.longitude,
      status: "pending",
      reporterEmail: args.reporterEmail,
      createdAt: Date.now(),
    });
    return reportId;
  },
});

// ──────────────────────────────────────────────
// Public report submission (called from Express)
// ──────────────────────────────────────────────

export const insertReport = mutation({
  args: {
    name: v.string(),
    phone: v.string(),
    category: v.string(),
    animalType: v.string(),
    quantity: v.optional(v.number()),
    location: v.string(),
    description: v.optional(v.string()),
    images: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    urgency: v.optional(v.string()),
    status: reportStatus,
    reporterIp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const reportId = await ctx.db.insert("reports", {
      name: args.name,
      phone: args.phone,
      category: args.category,
      animalType: args.animalType,
      quantity: args.quantity,
      location: args.location,
      description: args.description,
      images: args.images,
      latitude: args.latitude,
      longitude: args.longitude,
      urgency: args.urgency,
      status: args.status,
      reporterIp: args.reporterIp,
      createdAt: Date.now(),
    });
    return reportId;
  },
});

// ──────────────────────────────────────────────
// Rescuer queries / mutations
// ──────────────────────────────────────────────

export const getReports = query({
  args: {
    status: v.optional(reportStatus),
    assignedTo: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 200;
    if (args.assignedTo) {
      const reports = await ctx.db
        .query("reports")
        .withIndex("by_assignedTo", (q) => q.eq("assignedTo", args.assignedTo!))
        .order("desc")
        .take(limit);
      if (args.status) {
        return reports.filter((r) => r.status === args.status);
      }
      return reports;
    }
    if (args.status) {
      return await ctx.db
        .query("reports")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(limit);
    }
    return await ctx.db.query("reports").order("desc").take(limit);
  },
});

export const updateReportStatus = mutation({
  args: {
    reportId: v.id("reports"),
    status: reportStatus,
  },
  handler: async (ctx, args) => {
    const patch = { status: args.status } as any;
    if (args.status === "resolved" || args.status === "failed") {
      patch.resolvedAt = Date.now();
    }
    await ctx.db.patch(args.reportId, patch);
  },
});

export const rejectAssignment = mutation({
  args: {
    reportId: v.id("reports"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, {
      assignedTo: undefined,
      assignedUser: undefined,
      status: "pending",
    });
  },
});

export const getRescuerStats = query({
  args: { uuid: v.string() },
  handler: async (ctx, args) => {
    const allAssigned = await ctx.db
      .query("reports")
      .withIndex("by_assignedTo", (q) => q.eq("assignedTo", args.uuid))
      .collect();

    const activeRequests = allAssigned.filter(
      (r) => r.status !== "resolved" && r.status !== "failed"
    ).length;

    const completed = allAssigned.filter(
      (r) => r.status === "resolved"
    ).length;

    const totalAssigned = allAssigned.length;

    const recentReports = allAssigned
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, 10);

    return { activeRequests, completed, totalAssigned, recentReports };
  },
});

// ──────────────────────────────────────────────
// Admin queries / mutations
// ──────────────────────────────────────────────

export const getAdminReports = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("reports").order("desc").take(500);
  },
});

export const assignReport = mutation({
  args: {
    reportId: v.id("reports"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_uuid", (q) => q.eq("uuid", args.userId))
      .first();

    const assignedUser = user
      ? { firstName: user.firstName, lastName: user.lastName }
      : undefined;

    await ctx.db.patch(args.reportId, {
      assignedTo: args.userId,
      assignedUser,
      status: "assigned",
    });
  },
});

export const archiveReports = mutation({
  args: {
    reportIds: v.array(v.id("reports")),
    archivedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("users")
      .withIndex("by_uuid", (q) => q.eq("uuid", args.archivedBy))
      .first();

    const archivedByName = admin
      ? `${admin.firstName} ${admin.lastName}`
      : undefined;

    for (const id of args.reportIds) {
      await ctx.db.patch(id, {
        archivedAt: Date.now(),
        archivedByName,
      });
    }
  },
});

export const unarchiveReport = mutation({
  args: {
    reportId: v.id("reports"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, {
      archivedAt: undefined,
      archivedByName: undefined,
    });
  },
});

export const getArchivedReports = query({
  args: {},
  handler: async (ctx) => {
    const reports = await ctx.db.query("reports").order("desc").take(500);
    return reports.filter((r) => r.archivedAt != null);
  },
});

export const deleteReport = mutation({
  args: {
    reportId: v.id("reports"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.reportId);
  },
});

export const updateReportImages = mutation({
  args: {
    reportId: v.id("reports"),
    images: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, { images: args.images });
  },
});

export const updateReportRescuerImages = mutation({
  args: {
    reportId: v.id("reports"),
    rescuerImages: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, { rescuerImages: args.rescuerImages });
  },
});
