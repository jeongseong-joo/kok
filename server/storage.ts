import {
  users,
  regions,
  votes,
  voteOptions,
  userVotes,
  userRegions,
  comments,
  likes,
  type User,
  type UpsertUser,
  type Region,
  type InsertRegion,
  type Vote,
  type InsertVote,
  type VoteOption,
  type InsertVoteOption,
  type UserVote,
  type InsertUserVote,
  type UserRegion,
  type InsertUserRegion,
  type VoteWithDetails,
  type Comment,
  type InsertComment,
  type CommentWithUser,
  type CommentWithVote,
  type Like,
  type InsertLike,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, count, inArray, or, asc, exists, ilike } from "drizzle-orm";

export interface IStorage {
  // User operations (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Region operations
  getAllRegions(): Promise<Region[]>;
  getRegionsByLevel(level: string): Promise<Region[]>;
  getRegionById(id: number): Promise<Region | undefined>;
  createRegion(region: InsertRegion): Promise<Region>;
  getUserSelectedRegion(userId: string): Promise<Region | undefined>;
  setUserSelectedRegion(userId: string, regionId: number): Promise<void>;

  // Vote operations
  getVotesByRegion(regionId: number, userId?: string, searchQuery?: string, sortBy?: 'participants' | 'newest' | 'oldest'): Promise<VoteWithDetails[]>;
  getVotesByRegionHierarchy(regionId: number, userId?: string, searchQuery?: string, sortBy?: 'participants' | 'newest' | 'oldest'): Promise<VoteWithDetails[]>;
  getVoteById(id: number, userId?: string): Promise<VoteWithDetails | undefined>;
  createVote(vote: InsertVote, options: string[]): Promise<Vote>;
  castVote(userId: string, voteId: number, optionId: number): Promise<void>;
  hasUserVoted(userId: string, voteId: number): Promise<boolean>;
  getUserVoteOption(userId: string, voteId: number): Promise<number | undefined>;
  updateVote(voteId: number, userId: string, question: string, options: string[]): Promise<Vote>;
  deleteVote(voteId: number, userId: string): Promise<void>;

  // Comment operations
  getCommentsByVote(voteId: number): Promise<CommentWithUser[]>;
  createComment(comment: InsertComment): Promise<Comment>;
  deleteComment(commentId: number, userId: string): Promise<void>;
  getUserComments(userId: string): Promise<CommentWithVote[]>;

  // Like operations
  toggleLike(userId: string, voteId: number): Promise<boolean>; // returns true if liked, false if unliked
  getLikesCount(voteId: number): Promise<number>;
  hasUserLiked(userId: string, voteId: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Region operations
  async getAllRegions(): Promise<Region[]> {
    return await db.select().from(regions);
  }

  async getRegionsByLevel(level: string): Promise<Region[]> {
    return await db.select().from(regions).where(eq(regions.level, level));
  }

  async getRegionById(id: number): Promise<Region | undefined> {
    const [region] = await db.select().from(regions).where(eq(regions.id, id));
    return region;
  }

  async createRegion(region: InsertRegion): Promise<Region> {
    const [newRegion] = await db.insert(regions).values(region).returning();
    return newRegion;
  }

  async getUserSelectedRegion(userId: string): Promise<Region | undefined> {
    const [userRegion] = await db
      .select({ region: regions })
      .from(userRegions)
      .innerJoin(regions, eq(userRegions.regionId, regions.id))
      .where(and(eq(userRegions.userId, userId), eq(userRegions.isSelected, true)));
    
    return userRegion?.region;
  }

  async setUserSelectedRegion(userId: string, regionId: number): Promise<void> {
    // First, unset all selected regions for this user
    await db
      .update(userRegions)
      .set({ isSelected: false })
      .where(eq(userRegions.userId, userId));

    // Then set the new selected region or create it
    await db
      .insert(userRegions)
      .values({ userId, regionId, isSelected: true })
      .onConflictDoNothing();
  }

  // Vote operations
  async getVotesByRegionHierarchy(regionId: number, userId?: string, searchQuery?: string, sortBy?: 'participants' | 'newest' | 'oldest'): Promise<VoteWithDetails[]> {
    // Get the selected region
    const selectedRegion = await this.getRegionById(regionId);
    if (!selectedRegion) return [];

    if (selectedRegion.level === "country") {
      // Show all votes for the entire country
      const allVotes = await db
        .select()
        .from(votes)
        .orderBy(desc(votes.createdAt));
      
      const result: VoteWithDetails[] = [];
      
      for (const vote of allVotes) {
        const voteDetails = await this.getVoteById(vote.id, userId);
        if (voteDetails) {
          result.push(voteDetails);
        }
      }
      
      return result;
    } else if (selectedRegion.level === "province") {
      // Show votes for this province and all its child cities
      const childRegions = await db
        .select()
        .from(regions)
        .where(eq(regions.parentId, regionId));
      
      const targetRegionIds = [regionId, ...childRegions.map(r => r.id)];
      const result: VoteWithDetails[] = [];
      
      for (const targetId of targetRegionIds) {
        const regionVotes = await this.getVotesByRegion(targetId, userId, searchQuery, sortBy);
        result.push(...regionVotes);
      }
      
      return result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } else {
      // Show votes only for this specific city/district
      return this.getVotesByRegion(regionId, userId, searchQuery, sortBy);
    }
  }

  async getVotesByRegion(regionId: number, userId?: string, searchQuery?: string, sortBy?: 'participants' | 'newest' | 'oldest'): Promise<VoteWithDetails[]> {
    const votesData = await db
      .select({
        vote: votes,
        creator: users,
        region: regions,
      })
      .from(votes)
      .innerJoin(users, eq(votes.creatorId, users.id))
      .innerJoin(regions, eq(votes.regionId, regions.id))
      .where(eq(votes.regionId, regionId))
      .orderBy(desc(votes.createdAt));

    let result: VoteWithDetails[] = [];

    for (const voteData of votesData) {
      const options = await db
        .select()
        .from(voteOptions)
        .where(eq(voteOptions.voteId, voteData.vote.id));

      const totalVotes = options.reduce((sum, option) => sum + (option.voteCount || 0), 0);
      
      const optionsWithPercentage = options.map(option => ({
        ...option,
        percentage: totalVotes > 0 ? Math.round(((option.voteCount || 0) / totalVotes) * 100) : 0,
      }));

      let hasUserVoted = false;
      let userVotedOptionId: number | undefined;

      if (userId) {
        const userVoteOption = await this.getUserVoteOption(userId, voteData.vote.id);
        hasUserVoted = userVoteOption !== undefined;
        userVotedOptionId = userVoteOption;
      }

      // 댓글과 좋아요 정보 추가
      const commentsCount = await db.select({ count: count() }).from(comments).where(eq(comments.voteId, voteData.vote.id)).then(r => r[0]?.count || 0);
      const likesCount = await db.select({ count: count() }).from(likes).where(eq(likes.voteId, voteData.vote.id)).then(r => r[0]?.count || 0);
      const hasUserLiked = userId ? await this.hasUserLiked(userId, voteData.vote.id) : false;

      result.push({
        ...voteData.vote,
        creator: voteData.creator,
        region: voteData.region,
        options: optionsWithPercentage,
        totalVotes,
        hasUserVoted,
        userVotedOptionId,
        commentsCount,
        likesCount,
        hasUserLiked,
      });
    }

    // 검색 필터링 적용
    if (searchQuery && searchQuery.trim()) {
      const searchTerm = searchQuery.toLowerCase();
      console.log('Applying search filter:', searchTerm);
      console.log('Before filter:', result.length, 'votes');
      
      result = result.filter(vote => {
        // 투표 질문에서 검색
        const questionMatch = vote.question.toLowerCase().includes(searchTerm);
        
        // 투표 옵션에서 검색
        const optionMatch = vote.options.some(option => 
          option.text.toLowerCase().includes(searchTerm)
        );
        
        const matches = questionMatch || optionMatch;
        if (matches) {
          console.log('Vote matches:', vote.question);
        }
        
        return matches;
      });
      
      console.log('After filter:', result.length, 'votes');
    }

    // 정렬 적용
    if (sortBy) {
      switch (sortBy) {
        case 'participants':
          result.sort((a, b) => b.totalVotes - a.totalVotes);
          break;
        case 'newest':
          result.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
          break;
        case 'oldest':
          result.sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());
          break;
      }
    }

    return result;
  }

  async getVoteById(id: number, userId?: string): Promise<VoteWithDetails | undefined> {
    const [voteData] = await db
      .select({
        vote: votes,
        creator: users,
        region: regions,
      })
      .from(votes)
      .innerJoin(users, eq(votes.creatorId, users.id))
      .innerJoin(regions, eq(votes.regionId, regions.id))
      .where(eq(votes.id, id));

    if (!voteData) return undefined;

    const options = await db
      .select()
      .from(voteOptions)
      .where(eq(voteOptions.voteId, id));

    const totalVotes = options.reduce((sum, option) => sum + (option.voteCount || 0), 0);
    
    const optionsWithPercentage = options.map(option => ({
      ...option,
      percentage: totalVotes > 0 ? Math.round(((option.voteCount || 0) / totalVotes) * 100) : 0,
    }));

    let hasUserVoted = false;
    let userVotedOptionId: number | undefined;
    let hasUserLiked = false;
    let likesCount = 0;
    let commentsCount = 0;

    if (userId) {
      const userVoteOption = await this.getUserVoteOption(userId, id);
      hasUserVoted = userVoteOption !== undefined;
      userVotedOptionId = userVoteOption;
      hasUserLiked = await this.hasUserLiked(userId, id);
    }

    likesCount = await this.getLikesCount(id);
    commentsCount = (await this.getCommentsByVote(id)).length;

    return {
      ...voteData.vote,
      creator: voteData.creator,
      region: voteData.region,
      options: optionsWithPercentage,
      totalVotes,
      hasUserVoted,
      userVotedOptionId,
      hasUserLiked,
      likesCount,
      commentsCount,
    };
  }

  async createVote(vote: any, optionTexts: string[]): Promise<Vote> {
    const [newVote] = await db.insert(votes).values({
      question: vote.question,
      creatorId: vote.creatorId,
      regionId: vote.regionId,
      isActive: vote.isActive,
      endsAt: vote.endsAt,
    }).returning();

    for (const text of optionTexts) {
      await db.insert(voteOptions).values({
        voteId: newVote.id,
        text,
        voteCount: 0,
      });
    }

    return newVote;
  }

  async castVote(userId: string, voteId: number, optionId: number): Promise<void> {
    // Check if user already voted
    const existingVote = await this.hasUserVoted(userId, voteId);
    if (existingVote) {
      throw new Error("User has already voted on this poll");
    }

    // Record the vote
    await db.insert(userVotes).values({
      userId,
      voteId,
      optionId,
    });

    // Increment the vote count
    await db
      .update(voteOptions)
      .set({ voteCount: sql`${voteOptions.voteCount} + 1` })
      .where(eq(voteOptions.id, optionId));
  }

  async hasUserVoted(userId: string, voteId: number): Promise<boolean> {
    const [userVote] = await db
      .select()
      .from(userVotes)
      .where(and(eq(userVotes.userId, userId), eq(userVotes.voteId, voteId)));
    
    return !!userVote;
  }

  async getUserVoteOption(userId: string, voteId: number): Promise<number | undefined> {
    const [userVote] = await db
      .select()
      .from(userVotes)
      .where(and(eq(userVotes.userId, userId), eq(userVotes.voteId, voteId)));
    
    return userVote?.optionId;
  }

  async updateVote(voteId: number, userId: string, question: string, options: string[]): Promise<Vote> {
    console.log(`Updating vote ${voteId} by user ${userId} with question: ${question} and options:`, options);
    
    // 투표 소유자 확인
    const [vote] = await db.select().from(votes).where(eq(votes.id, voteId));
    console.log("Found vote for update:", vote);
    
    if (!vote || vote.creatorId !== userId) {
      throw new Error("투표를 수정할 권한이 없습니다");
    }

    // 트랜잭션으로 투표와 옵션 업데이트
    return await db.transaction(async (tx) => {
      console.log("수정 트랜잭션 시작");
      
      // 투표 제목 업데이트
      const [updatedVote] = await tx
        .update(votes)
        .set({ question })
        .where(eq(votes.id, voteId))
        .returning();
      console.log("투표 제목 업데이트 완료:", updatedVote);

      // 기존 옵션 삭제
      const deletedOptions = await tx.delete(voteOptions).where(eq(voteOptions.voteId, voteId)).returning();
      console.log("기존 옵션 삭제 완료:", deletedOptions.length);

      // 새 옵션 추가
      const newOptions = options.map((text, index) => ({
        voteId,
        text,
        order: index,
      }));
      const insertedOptions = await tx.insert(voteOptions).values(newOptions).returning();
      console.log("새 옵션 추가 완료:", insertedOptions.length);

      return updatedVote;
    });
  }

  async deleteVote(voteId: number, userId: string): Promise<void> {
    console.log(`Deleting vote ${voteId} by user ${userId}`);
    
    // 투표 소유자 확인
    const [vote] = await db.select().from(votes).where(eq(votes.id, voteId));
    console.log("Found vote:", vote);
    
    if (!vote || vote.creatorId !== userId) {
      throw new Error("투표를 삭제할 권한이 없습니다");
    }

    // CASCADE 삭제로 관련 데이터 자동 삭제
    const deletedVote = await db.delete(votes).where(eq(votes.id, voteId)).returning();
    console.log("삭제된 투표:", deletedVote);
    
    console.log(`Vote ${voteId} 삭제 완료`);
  }

  // Comment operations
  async getCommentsByVote(voteId: number): Promise<CommentWithUser[]> {
    return await db
      .select({
        comment: comments,
        user: users,
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.voteId, voteId))
      .orderBy(desc(comments.createdAt))
      .then(results => results.map(r => ({ ...r.comment, user: r.user })));
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    console.log("Storage: Creating comment with data:", comment);
    try {
      const [newComment] = await db.insert(comments).values({
        ...comment,
        createdAt: new Date(),
      }).returning();
      console.log("Storage: Comment created successfully:", newComment);
      return newComment;
    } catch (error) {
      console.error("Storage: Error creating comment:", error);
      throw error;
    }
  }

  async deleteComment(commentId: number, userId: string): Promise<void> {
    const [comment] = await db.select().from(comments).where(eq(comments.id, commentId));
    if (!comment || comment.userId !== userId) {
      throw new Error("댓글을 삭제할 권한이 없습니다");
    }
    await db.delete(comments).where(eq(comments.id, commentId));
  }

  // Like operations
  async toggleLike(userId: string, voteId: number): Promise<boolean> {
    const existingLike = await db.select().from(likes).where(
      and(eq(likes.userId, userId), eq(likes.voteId, voteId))
    );

    if (existingLike.length > 0) {
      // Unlike
      await db.delete(likes).where(
        and(eq(likes.userId, userId), eq(likes.voteId, voteId))
      );
      return false;
    } else {
      // Like
      await db.insert(likes).values({ userId, voteId });
      return true;
    }
  }

  async getLikesCount(voteId: number): Promise<number> {
    const [result] = await db.select({ count: count() }).from(likes).where(eq(likes.voteId, voteId));
    return result.count;
  }

  async hasUserLiked(userId: string, voteId: number): Promise<boolean> {
    const [like] = await db.select().from(likes).where(
      and(eq(likes.userId, userId), eq(likes.voteId, voteId))
    );
    return !!like;
  }

  async getUserComments(userId: string): Promise<CommentWithVote[]> {
    const userComments = await db
      .select()
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .innerJoin(votes, eq(comments.voteId, votes.id))
      .innerJoin(regions, eq(votes.regionId, regions.id))
      .where(eq(comments.userId, userId))
      .orderBy(desc(comments.createdAt));

    return userComments.map(row => ({
      id: row.comments.id,
      content: row.comments.content,
      createdAt: row.comments.createdAt,
      voteId: row.comments.voteId,
      userId: row.comments.userId,
      user: {
        id: row.users.id,
        email: row.users.email,
        firstName: row.users.firstName,
        lastName: row.users.lastName,
        profileImageUrl: row.users.profileImageUrl,
        createdAt: row.users.createdAt,
        updatedAt: row.users.updatedAt,
      },
      vote: {
        id: row.votes.id,
        question: row.votes.question,
        region: {
          id: row.regions.id,
          name: row.regions.name,
          level: row.regions.level,
          parentId: row.regions.parentId,
          createdAt: null,
        },
      },
    }));
  }
}

export const storage = new DatabaseStorage();
