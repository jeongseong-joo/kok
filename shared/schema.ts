import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const regions = pgTable("regions", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  level: varchar("level").notNull(), // "country", "province", "city"
  parentId: integer("parent_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  creatorId: varchar("creator_id").notNull(),
  regionId: integer("region_id").notNull(),
  isActive: boolean("is_active").default(true),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const voteOptions = pgTable("vote_options", {
  id: serial("id").primaryKey(),
  voteId: integer("vote_id").notNull().references(() => votes.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  voteCount: integer("vote_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userVotes = pgTable("user_votes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  voteId: integer("vote_id").notNull().references(() => votes.id, { onDelete: "cascade" }),
  optionId: integer("option_id").notNull().references(() => voteOptions.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userRegions = pgTable("user_regions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  regionId: integer("region_id").notNull(),
  isSelected: boolean("is_selected").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueUserRegion: unique().on(table.userId, table.regionId),
}));

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  voteId: integer("vote_id").notNull().references(() => votes.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const likes = pgTable("likes", {
  id: serial("id").primaryKey(),
  voteId: integer("vote_id").notNull().references(() => votes.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueUserVoteLike: unique().on(table.userId, table.voteId),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  votes: many(votes),
  userVotes: many(userVotes),
  userRegions: many(userRegions),
  comments: many(comments),
  likes: many(likes),
}));

export const regionsRelations = relations(regions, ({ one, many }) => ({
  parent: one(regions, {
    fields: [regions.parentId],
    references: [regions.id],
  }),
  children: many(regions),
  votes: many(votes),
  userRegions: many(userRegions),
}));

export const votesRelations = relations(votes, ({ one, many }) => ({
  creator: one(users, {
    fields: [votes.creatorId],
    references: [users.id],
  }),
  region: one(regions, {
    fields: [votes.regionId],
    references: [regions.id],
  }),
  options: many(voteOptions),
  userVotes: many(userVotes),
  comments: many(comments),
  likes: many(likes),
}));

export const voteOptionsRelations = relations(voteOptions, ({ one, many }) => ({
  vote: one(votes, {
    fields: [voteOptions.voteId],
    references: [votes.id],
  }),
  userVotes: many(userVotes),
}));

export const userVotesRelations = relations(userVotes, ({ one }) => ({
  user: one(users, {
    fields: [userVotes.userId],
    references: [users.id],
  }),
  vote: one(votes, {
    fields: [userVotes.voteId],
    references: [votes.id],
  }),
  option: one(voteOptions, {
    fields: [userVotes.optionId],
    references: [voteOptions.id],
  }),
}));

export const userRegionsRelations = relations(userRegions, ({ one }) => ({
  user: one(users, {
    fields: [userRegions.userId],
    references: [users.id],
  }),
  region: one(regions, {
    fields: [userRegions.regionId],
    references: [regions.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  vote: one(votes, {
    fields: [comments.voteId],
    references: [votes.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));

export const likesRelations = relations(likes, ({ one }) => ({
  vote: one(votes, {
    fields: [likes.voteId],
    references: [votes.id],
  }),
  user: one(users, {
    fields: [likes.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertRegionSchema = createInsertSchema(regions).omit({
  id: true,
  createdAt: true,
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
  createdAt: true,
});

export const insertVoteOptionSchema = createInsertSchema(voteOptions).omit({
  id: true,
  createdAt: true,
  voteCount: true,
});

export const insertUserVoteSchema = createInsertSchema(userVotes).omit({
  id: true,
  createdAt: true,
});

export const insertUserRegionSchema = createInsertSchema(userRegions).omit({
  id: true,
  createdAt: true,
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
});

export const insertLikeSchema = createInsertSchema(likes).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Region = typeof regions.$inferSelect;
export type InsertRegion = z.infer<typeof insertRegionSchema>;
export type Vote = typeof votes.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type VoteOption = typeof voteOptions.$inferSelect;
export type InsertVoteOption = z.infer<typeof insertVoteOptionSchema>;
export type UserVote = typeof userVotes.$inferSelect;
export type InsertUserVote = z.infer<typeof insertUserVoteSchema>;
export type UserRegion = typeof userRegions.$inferSelect;
export type InsertUserRegion = z.infer<typeof insertUserRegionSchema>;
export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Like = typeof likes.$inferSelect;
export type InsertLike = z.infer<typeof insertLikeSchema>;

// Extended types for API responses
export type VoteWithDetails = Vote & {
  creator: User;
  region: Region;
  options: (VoteOption & { percentage: number })[];
  totalVotes: number;
  hasUserVoted: boolean;
  userVotedOptionId?: number;
  commentsCount: number;
  likesCount: number;
  hasUserLiked: boolean;
};

export type CommentWithUser = Comment & {
  user: User;
};

export type CommentWithVote = Comment & {
  user: User;
  vote: {
    id: number;
    question: string;
    region: Region;
  };
};
