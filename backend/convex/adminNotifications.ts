import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const insertNotification = mutation({
  args: {
    type: v.string(),
    message: v.string(),
    reportId: v.optional(v.string()),
    link: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("adminNotifications", {
      type: args.type,
      message: args.message,
      reportId: args.reportId,
      link: args.link,
      read: false,
      createdAt: Date.now(),
    });
  },
});

export const getNotifications = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db
      .query("adminNotifications")
      .withIndex("by_createdAt", (idx) => idx.gte("createdAt", 0))
      .order("desc")
      .take(limit);
  },
});

export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("adminNotifications")
      .withIndex("by_read", (idx) => idx.eq("read", false))
      .collect();
    return all.length;
  },
});

export const markAsRead = mutation({
  args: { id: v.id("adminNotifications") },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.id, { read: true });
  },
});

export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const unread = await ctx.db
      .query("adminNotifications")
      .withIndex("by_read", (idx) => idx.eq("read", false))
      .collect();
    for (const n of unread) {
      await ctx.db.patch(n._id, { read: true });
    }
  },
});
