import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  otps: defineTable({
    email: v.string(),
    otp: v.string(),
    expiresAt: v.number(),
    used: v.boolean(),
  })
    .index("by_email", ["email"]),

  users: defineTable({
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
      v.literal("user"),
    ),
    availability: v.optional(v.union(
      v.literal("available"),
      v.literal("busy"),
    )),
    organization: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_uuid", ["uuid"])
    .index("by_phoneNumber", ["phoneNumber"]),

  admins: defineTable({
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
  })
    .index("by_email", ["email"]),

  rescuers: defineTable({
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    phoneNumber: v.string(),
  })
    .index("by_email", ["email"]),

  reports: defineTable({
    name: v.string(),
    phone: v.string(),
    category: v.string(),
    animalType: v.string(),
    quantity: v.optional(v.number()),
    location: v.string(),
    description: v.optional(v.string()),
    images: v.optional(v.string()),
    rescuerImages: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    urgency: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("assigned"),
      v.literal("en_route"),
      v.literal("in_progress"),
      v.literal("resolved"),
      v.literal("failed"),
    ),
    assignedTo: v.optional(v.string()),
    assignedUser: v.optional(v.object({ firstName: v.string(), lastName: v.string() })),
    reporterEmail: v.optional(v.string()),
    reporterIp: v.optional(v.string()),
    createdAt: v.number(),
    archivedAt: v.optional(v.number()),
    archivedByName: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_assignedTo", ["assignedTo"])
    .index("by_status", ["status"]),

  adminNotifications: defineTable({
    type: v.string(),
    message: v.string(),
    reportId: v.optional(v.string()),
    link: v.optional(v.string()),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_read", ["read"])
    .index("by_createdAt", ["createdAt"]),

  rescuerNotifications: defineTable({
    userId: v.string(),
    reportId: v.string(),
    type: v.string(),
    message: v.string(),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_read", ["userId", "read"]),

  activityLogs: defineTable({
    userId: v.string(),
    action: v.string(),
    reportId: v.optional(v.string()),
    details: v.string(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"]),

  rescuerLocations: defineTable({
    userId: v.string(),
    userName: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    heading: v.optional(v.number()),
    speed: v.optional(v.number()),
    updatedAt: v.number(),
    reportId: v.optional(v.id("reports")),
    animalName: v.optional(v.string()),
    isTracking: v.optional(v.boolean()),
  })
    .index("by_userId", ["userId"])
    .index("by_tracking", ["isTracking"]),

  config: defineTable({
    key: v.string(),
    value: v.string(),
  })
    .index("by_key", ["key"]),

  shifts: defineTable({
    userId: v.string(),
    dayOfWeek: v.number(),
    startTime: v.string(),
    endTime: v.string(),
    active: v.boolean(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_day", ["userId", "dayOfWeek"]),

  equipmentChecklists: defineTable({
    reportId: v.string(),
    userId: v.string(),
    items: v.array(
      v.object({
        label: v.string(),
        checked: v.boolean(),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_reportId", ["reportId"]),

  logs: defineTable({
    userId: v.optional(v.string()),
    eventType: v.string(),
    section: v.optional(v.string()),
    ipAddress: v.string(),
    userAgent: v.optional(v.string()),
    metadata: v.optional(v.string()),
    sessionDuration: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_eventType", ["eventType"])
    .index("by_ipAddress", ["ipAddress"])
    .index("by_createdAt", ["createdAt"]),
  reportNotes: defineTable({
    reportId: v.string(),
    userId: v.string(),
    userName: v.string(),
    content: v.string(),
    createdAt: v.number(),
  })
    .index("by_reportId", ["reportId"]),

});
