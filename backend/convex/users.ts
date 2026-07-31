import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createUser = mutation({
  args: {
    uuid: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    phoneNumber: v.string(),
    email: v.string(),
    password: v.string(),
    role: v.union(
      v.literal("superadmin"),
      v.literal("admin"),
      v.literal("rescuer"),
    ),
    organization: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", {
      uuid: args.uuid,
      firstName: args.firstName,
      lastName: args.lastName,
      phoneNumber: args.phoneNumber,
      email: args.email,
      password: args.password,
      role: args.role,
      organization: args.organization,
    });
  },
});

export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
  },
});

export const getUserByPhoneNumber = query({
  args: { phoneNumber: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_phoneNumber", (q) => q.eq("phoneNumber", args.phoneNumber))
      .unique();
  },
});

export const getUserByUuid = query({
  args: { uuid: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_uuid", (q) => q.eq("uuid", args.uuid))
      .unique();
  },
});

export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").order("desc").collect();
  },
});

export const updateUser = mutation({
  args: {
    uuid: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    organization: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_uuid", (q) => q.eq("uuid", args.uuid))
      .unique();
    if (!user) throw new Error("User not found");
    const patch: Record<string, string | undefined> = {};
    if (args.firstName !== undefined) patch.firstName = args.firstName;
    if (args.lastName !== undefined) patch.lastName = args.lastName;
    if (args.phoneNumber !== undefined) patch.phoneNumber = args.phoneNumber;
    if (args.email !== undefined) patch.email = args.email;
    if (args.organization !== undefined) patch.organization = args.organization;
    return await ctx.db.patch(user._id, patch);
  },
});

export const updatePassword = mutation({
  args: { uuid: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_uuid", (q) => q.eq("uuid", args.uuid))
      .unique();
    if (!user) throw new Error("User not found");
    return await ctx.db.patch(user._id, { password: args.password });
  },
});

export const updateUserRole = mutation({
  args: {
    uuid: v.string(),
    role: v.union(
      v.literal("superadmin"),
      v.literal("admin"),
      v.literal("rescuer"),
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_uuid", (q) => q.eq("uuid", args.uuid))
      .unique();
    if (!user) throw new Error("User not found");
    return await ctx.db.patch(user._id, { role: args.role });
  },
});

export const updateAvailability = mutation({
  args: {
    uuid: v.string(),
    availability: v.union(
      v.literal("available"),
      v.literal("busy"),
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_uuid", (q) => q.eq("uuid", args.uuid))
      .unique();
    if (!user) throw new Error("User not found");
    return await ctx.db.patch(user._id, { availability: args.availability });
  },
});
