import { relations } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  boolean,
  integer,
  index,
  uniqueIndex,
  numeric,
  serial,
} from "drizzle-orm/pg-core";

// =====================================================================
// AUTH (better-auth) — dipakai bersama oleh finance-zenio & pintarpy
// =====================================================================

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)]
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

// =====================================================================
// FINANCE-ZENIO
// =====================================================================

// TABLE PENGELUARAN (ID, NAMA_PENGELUARAN, NOMINAL, CREATED_AT, ID_USER, KATEGORI)
export const pengeluaran = pgTable("pengeluaran", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  namaPengeluaran: text("nama_pengeluaran").notNull(),
  nominal: numeric("nominal", { precision: 15, scale: 2 }).notNull(),
  kategori: text("kategori").notNull().default("Lainnya"),
});

// TABLE PEMASUKAN (ID, NAMA_PEMASUKAN, NOMINAL, CREATED_AT, ID_USER, KATEGORI)
export const pemasukan = pgTable("pemasukan", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  namaPemasukan: text("nama_pemasukan").notNull(),
  nominal: numeric("nominal", { precision: 15, scale: 2 }).notNull(),
  kategori: text("kategori").notNull().default("Lainnya"),
});

// =====================================================================
// PINTARPY
// =====================================================================

export const courseStatus = pgEnum("course_status", [
  "locked",
  "in_progress",
  "completed",
]);

export const course = pgTable("course", {
  id: text("id").primaryKey(),
  title: text("title").notNull().unique(),
  description: text("description").notNull(),
  duration: integer("duration").notNull(), // durasi dalam menit
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userCourseProgress = pgTable(
  "user_course_progress",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => course.id, { onDelete: "cascade" }),
    progress: integer("progress").default(0).notNull(), // 0 - 100
    status: courseStatus("status").default("locked").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    // hanya 1 progress per user per course
    uniqueIndex("user_course_progress_user_id_course_id_uq").on(
      table.userId,
      table.courseId
    ),
    index("user_course_progress_user_id_idx").on(table.userId),
  ]
);

export const blogPost = pgTable("blog_post", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull().unique(),
  slug: text("slug").notNull().unique(),
  imgLink: text("img_link"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  timesOpened: integer("times_opened").default(0).notNull(),
});

// =====================================================================
// RELATIONS
// =====================================================================

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  pengeluaran: many(pengeluaran),
  pemasukan: many(pemasukan),
  courseProgress: many(userCourseProgress),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

// PENGELUARAN → USER
export const pengeluaranRelations = relations(pengeluaran, ({ one }) => ({
  user: one(user, {
    fields: [pengeluaran.userId],
    references: [user.id],
  }),
}));

// PEMASUKAN → USER
export const pemasukanRelations = relations(pemasukan, ({ one }) => ({
  user: one(user, {
    fields: [pemasukan.userId],
    references: [user.id],
  }),
}));

// COURSE → PROGRESS
export const courseRelations = relations(course, ({ many }) => ({
  progress: many(userCourseProgress),
}));

// PROGRESS → USER, COURSE
export const userCourseProgressRelations = relations(
  userCourseProgress,
  ({ one }) => ({
    user: one(user, {
      fields: [userCourseProgress.userId],
      references: [user.id],
    }),
    course: one(course, {
      fields: [userCourseProgress.courseId],
      references: [course.id],
    }),
  })
);
