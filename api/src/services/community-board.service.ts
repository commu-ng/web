import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";
import { db } from "../db";
import {
  communityBoard as communityBoardTable,
  communityBoardPost as communityBoardPostTable,
  communityBoardPostReply as communityBoardPostReplyTable,
  image as imageTable,
  profile as profileTable,
  profilePicture as profilePictureTable,
} from "../drizzle/schema";
import { AppException } from "../exception";
import { CommunityBoardErrorCode } from "../types/api-responses";
import { addImageUrl } from "../utils/r2";

/**
 * Get all boards for a community
 */
export async function getCommunityBoards(communityId: string) {
  const boards = await db.query.communityBoard.findMany({
    where: and(
      eq(communityBoardTable.communityId, communityId),
      isNull(communityBoardTable.deletedAt),
    ),
    orderBy: [asc(communityBoardTable.createdAt)],
  });

  return boards.map((board) => ({
    id: board.id,
    name: board.name,
    slug: board.slug,
    description: board.description,
    allow_comments: board.allowComments,
    created_at: board.createdAt,
    updated_at: board.updatedAt,
  }));
}

/**
 * Get a single community board by slug
 */
export async function getCommunityBoardBySlug(
  communityId: string,
  slug: string,
) {
  const board = await db.query.communityBoard.findFirst({
    where: and(
      eq(communityBoardTable.communityId, communityId),
      eq(communityBoardTable.slug, slug),
      isNull(communityBoardTable.deletedAt),
    ),
  });

  if (!board) {
    throw new AppException(
      404,
      CommunityBoardErrorCode.BOARD_NOT_FOUND,
      "Board not found",
    );
  }

  return {
    id: board.id,
    name: board.name,
    slug: board.slug,
    description: board.description,
    allow_comments: board.allowComments,
    created_at: board.createdAt,
    updated_at: board.updatedAt,
  };
}

/**
 * Get a single community board by ID
 */
export async function getCommunityBoardById(
  communityId: string,
  boardId: string,
) {
  const board = await db.query.communityBoard.findFirst({
    where: and(
      eq(communityBoardTable.id, boardId),
      eq(communityBoardTable.communityId, communityId),
      isNull(communityBoardTable.deletedAt),
    ),
  });

  if (!board) {
    throw new AppException(
      404,
      CommunityBoardErrorCode.BOARD_NOT_FOUND,
      "Board not found",
    );
  }

  return {
    id: board.id,
    name: board.name,
    slug: board.slug,
    description: board.description,
    allow_comments: board.allowComments,
    created_at: board.createdAt,
    updated_at: board.updatedAt,
  };
}

/**
 * Create a new community board
 */
export async function createCommunityBoard(
  communityId: string,
  name: string,
  slug: string,
  description: string | null | undefined,
  allowComments: boolean = true,
) {
  // Check if slug already exists in this community
  const existingBoard = await db.query.communityBoard.findFirst({
    where: and(
      eq(communityBoardTable.communityId, communityId),
      eq(communityBoardTable.slug, slug),
      isNull(communityBoardTable.deletedAt),
    ),
  });

  if (existingBoard) {
    throw new AppException(
      409,
      CommunityBoardErrorCode.DUPLICATE_BOARD_SLUG,
      "Board slug already exists in this community",
    );
  }

  const newBoardResult = await db
    .insert(communityBoardTable)
    .values({
      communityId,
      name,
      slug,
      description: description || null,
      allowComments,
    })
    .returning();

  const newBoard = newBoardResult[0];
  if (!newBoard) {
    throw new Error("Failed to create board");
  }

  return {
    id: newBoard.id,
    name: newBoard.name,
    slug: newBoard.slug,
    description: newBoard.description,
    allow_comments: newBoard.allowComments,
    created_at: newBoard.createdAt,
    updated_at: newBoard.updatedAt,
  };
}

/**
 * Update a community board
 */
export async function updateCommunityBoard(
  communityId: string,
  boardId: string,
  name: string,
  slug: string,
  description: string | null | undefined,
  allowComments?: boolean,
) {
  // Check if board exists
  const board = await db.query.communityBoard.findFirst({
    where: and(
      eq(communityBoardTable.id, boardId),
      eq(communityBoardTable.communityId, communityId),
      isNull(communityBoardTable.deletedAt),
    ),
  });

  if (!board) {
    throw new AppException(
      404,
      CommunityBoardErrorCode.BOARD_NOT_FOUND,
      "Board not found",
    );
  }

  // Check if slug is taken by another board in the same community
  if (slug !== board.slug) {
    const existingBoard = await db.query.communityBoard.findFirst({
      where: and(
        eq(communityBoardTable.communityId, communityId),
        eq(communityBoardTable.slug, slug),
        isNull(communityBoardTable.deletedAt),
      ),
    });

    if (existingBoard && existingBoard.id !== boardId) {
      throw new AppException(
        409,
        CommunityBoardErrorCode.DUPLICATE_BOARD_SLUG,
        "Board slug already exists in this community",
      );
    }
  }

  const updateData: Record<string, unknown> = {
    name,
    slug,
    description: description || null,
    updatedAt: sql`NOW()`,
  };

  if (allowComments !== undefined) {
    updateData.allowComments = allowComments;
  }

  const updatedBoardResult = await db
    .update(communityBoardTable)
    .set(updateData)
    .where(eq(communityBoardTable.id, boardId))
    .returning();

  const updatedBoard = updatedBoardResult[0];
  if (!updatedBoard) {
    throw new Error("Failed to update board");
  }

  return {
    id: updatedBoard.id,
    name: updatedBoard.name,
    slug: updatedBoard.slug,
    description: updatedBoard.description,
    allow_comments: updatedBoard.allowComments,
    created_at: updatedBoard.createdAt,
    updated_at: updatedBoard.updatedAt,
  };
}

/**
 * Delete a community board
 */
export async function deleteCommunityBoard(
  communityId: string,
  boardId: string,
) {
  const board = await db.query.communityBoard.findFirst({
    where: and(
      eq(communityBoardTable.id, boardId),
      eq(communityBoardTable.communityId, communityId),
      isNull(communityBoardTable.deletedAt),
    ),
  });

  if (!board) {
    throw new AppException(
      404,
      CommunityBoardErrorCode.BOARD_NOT_FOUND,
      "Board not found",
    );
  }

  await db
    .update(communityBoardTable)
    .set({
      deletedAt: sql`NOW()`,
    })
    .where(eq(communityBoardTable.id, boardId));
}

/**
 * Helper function to get profile picture
 */
async function getProfilePicture(profileId: string) {
  const profilePicture = await db.query.profilePicture.findFirst({
    where: and(
      eq(profilePictureTable.profileId, profileId),
      isNull(profilePictureTable.deletedAt),
    ),
    with: {
      image: true,
    },
    orderBy: [desc(profilePictureTable.createdAt)],
  });

  if (profilePicture?.image) {
    return {
      id: profilePicture.image.id,
      url: addImageUrl(profilePicture.image).url,
      width: profilePicture.image.width,
      height: profilePicture.image.height,
    };
  }
  return null;
}

/**
 * Get posts for a community board with pagination
 */
export async function getCommunityBoardPosts(
  boardId: string,
  limit: number = 20,
  cursor?: string,
) {
  // Build base conditions (without cursor) for count query
  const baseConditions = [
    eq(communityBoardPostTable.boardId, boardId),
    isNull(communityBoardPostTable.deletedAt),
  ];

  // Build query conditions (with cursor)
  const queryConditions = [...baseConditions];
  if (cursor) {
    queryConditions.push(sql`${communityBoardPostTable.id} < ${cursor}`);
  }

  // Run count and data queries in parallel
  const [posts, totalCountResult] = await Promise.all([
    db
      .select()
      .from(communityBoardPostTable)
      .leftJoin(
        profileTable,
        eq(communityBoardPostTable.authorId, profileTable.id),
      )
      .where(and(...queryConditions))
      .orderBy(desc(communityBoardPostTable.id))
      .limit(limit + 1),
    db
      .select({ count: count() })
      .from(communityBoardPostTable)
      .where(and(...baseConditions)),
  ]);

  const totalCount = totalCountResult[0]?.count ?? 0;

  // Check if there are more results
  const hasMore = posts.length > limit;
  const postsToReturn = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor =
    hasMore && postsToReturn.length > 0
      ? postsToReturn[postsToReturn.length - 1]?.community_board_post?.id ||
        null
      : null;

  // Collect all post IDs for batch loading
  const imageIds = postsToReturn
    .map((row) => row.community_board_post?.imageId)
    .filter((id): id is string => id !== undefined && id !== null);

  const profileIds = postsToReturn
    .map((row) => row.profile?.id)
    .filter((id): id is string => id !== undefined && id !== null);

  // Batch load images
  const allImages =
    imageIds.length > 0
      ? await db.query.image.findMany({
          where: inArray(imageTable.id, imageIds),
        })
      : [];

  // Batch load profile pictures
  const profilePictures =
    profileIds.length > 0
      ? await db.query.profilePicture.findMany({
          where: and(
            inArray(profilePictureTable.profileId, profileIds),
            isNull(profilePictureTable.deletedAt),
          ),
          with: {
            image: true,
          },
        })
      : [];

  // Create image map
  const imageMap = new Map(allImages.map((img) => [img.id, img]));

  // Create profile picture map (most recent per profile)
  const profilePictureMap = new Map<
    string,
    { id: string; url: string; width: number; height: number }
  >();
  for (const pp of profilePictures) {
    if (pp.image && !profilePictureMap.has(pp.profileId)) {
      profilePictureMap.set(pp.profileId, {
        id: pp.image.id,
        url: addImageUrl(pp.image).url,
        width: pp.image.width,
        height: pp.image.height,
      });
    }
  }

  // Build result
  const result = postsToReturn
    .map((row) => {
      const post = row.community_board_post;
      const author = row.profile;

      if (!post || !author) return null;

      const image = post.imageId ? imageMap.get(post.imageId) : null;
      const profilePicture = profilePictureMap.get(author.id) || null;

      return {
        id: post.id,
        title: post.title,
        content: post.content,
        image: image
          ? {
              id: image.id,
              url: addImageUrl(image).url,
              width: image.width,
              height: image.height,
              filename: image.filename,
            }
          : null,
        author: {
          id: author.id,
          name: author.name,
          username: author.username,
          profile_picture: profilePicture,
        },
        created_at: post.createdAt,
        updated_at: post.updatedAt,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    data: result,
    pagination: {
      next_cursor: nextCursor,
      has_more: hasMore,
      total_count: totalCount,
    },
  };
}

/**
 * Get a single community board post
 */
export async function getCommunityBoardPost(postId: string) {
  const post = await db.query.communityBoardPost.findFirst({
    where: and(
      eq(communityBoardPostTable.id, postId),
      isNull(communityBoardPostTable.deletedAt),
    ),
    with: {
      author: true,
      image: true,
      board: true,
    },
  });

  if (!post) {
    throw new AppException(
      404,
      CommunityBoardErrorCode.POST_NOT_FOUND,
      "Post not found",
    );
  }

  const profilePicture = await getProfilePicture(post.author.id);

  return {
    id: post.id,
    title: post.title,
    content: post.content,
    image: post.image
      ? {
          id: post.image.id,
          url: addImageUrl(post.image).url,
          width: post.image.width,
          height: post.image.height,
          filename: post.image.filename,
        }
      : null,
    author: {
      id: post.author.id,
      name: post.author.name,
      username: post.author.username,
      profile_picture: profilePicture,
    },
    board: {
      id: post.board.id,
      name: post.board.name,
      slug: post.board.slug,
      allow_comments: post.board.allowComments,
    },
    created_at: post.createdAt,
    updated_at: post.updatedAt,
  };
}

/**
 * Create a community board post
 */
export async function createCommunityBoardPost(
  boardId: string,
  authorId: string,
  title: string,
  content: string,
  imageId: string | null | undefined,
) {
  // Validate board exists
  const board = await db.query.communityBoard.findFirst({
    where: and(
      eq(communityBoardTable.id, boardId),
      isNull(communityBoardTable.deletedAt),
    ),
  });

  if (!board) {
    throw new AppException(
      404,
      CommunityBoardErrorCode.BOARD_NOT_FOUND,
      "Board not found",
    );
  }

  // Validate profile exists
  const profile = await db.query.profile.findFirst({
    where: eq(profileTable.id, authorId),
  });

  if (!profile) {
    throw new AppException(
      404,
      CommunityBoardErrorCode.UNAUTHORIZED,
      "Profile not found",
    );
  }

  // Validate image if provided
  if (imageId) {
    const image = await db.query.image.findFirst({
      where: and(eq(imageTable.id, imageId), isNull(imageTable.deletedAt)),
    });

    if (!image) {
      throw new AppException(
        400,
        CommunityBoardErrorCode.INVALID_IMAGE,
        "Invalid image",
      );
    }
  }

  // Create post
  const newPostResult = await db
    .insert(communityBoardPostTable)
    .values({
      boardId,
      authorId,
      title,
      content,
      imageId: imageId || null,
    })
    .returning();

  const newPost = newPostResult[0];
  if (!newPost) {
    throw new Error("Failed to create post");
  }

  // Get the created post with all relations
  return getCommunityBoardPost(newPost.id);
}

/**
 * Update a community board post
 */
export async function updateCommunityBoardPost(
  postId: string,
  authorId: string,
  title: string,
  content: string,
  imageId: string | null | undefined,
) {
  // Check if post exists
  const post = await db.query.communityBoardPost.findFirst({
    where: and(
      eq(communityBoardPostTable.id, postId),
      isNull(communityBoardPostTable.deletedAt),
    ),
  });

  if (!post) {
    throw new AppException(
      404,
      CommunityBoardErrorCode.POST_NOT_FOUND,
      "Post not found",
    );
  }

  // Check if profile is the author
  if (post.authorId !== authorId) {
    throw new AppException(
      403,
      CommunityBoardErrorCode.NOT_POST_AUTHOR,
      "Only the author can modify this post",
    );
  }

  // Validate image if provided
  if (imageId) {
    const image = await db.query.image.findFirst({
      where: and(eq(imageTable.id, imageId), isNull(imageTable.deletedAt)),
    });

    if (!image) {
      throw new AppException(
        400,
        CommunityBoardErrorCode.INVALID_IMAGE,
        "Invalid image",
      );
    }
  }

  // Update the post
  await db
    .update(communityBoardPostTable)
    .set({
      title,
      content,
      imageId: imageId || null,
      updatedAt: sql`NOW()`,
    })
    .where(eq(communityBoardPostTable.id, postId));

  // Get the updated post
  return getCommunityBoardPost(postId);
}

/**
 * Delete a community board post
 */
export async function deleteCommunityBoardPost(
  postId: string,
  profileId: string,
) {
  const post = await db.query.communityBoardPost.findFirst({
    where: and(
      eq(communityBoardPostTable.id, postId),
      isNull(communityBoardPostTable.deletedAt),
    ),
  });

  if (!post) {
    throw new AppException(
      404,
      CommunityBoardErrorCode.POST_NOT_FOUND,
      "Post not found",
    );
  }

  // Check if profile is the author
  if (post.authorId !== profileId) {
    throw new AppException(
      403,
      CommunityBoardErrorCode.NOT_POST_AUTHOR,
      "Only the author can delete this post",
    );
  }

  // Soft-delete the post
  await db
    .update(communityBoardPostTable)
    .set({
      deletedAt: sql`NOW()`,
    })
    .where(eq(communityBoardPostTable.id, postId));

  // Cascade delete all replies for this post
  await db
    .update(communityBoardPostReplyTable)
    .set({
      deletedAt: sql`NOW()`,
    })
    .where(
      and(
        eq(communityBoardPostReplyTable.postId, postId),
        isNull(communityBoardPostReplyTable.deletedAt),
      ),
    );
}

/**
 * Helper to build nested reply tree
 */
function buildReplyTree(
  replies: {
    id: string;
    content: string;
    inReplyToId: string | null;
    depth: number;
    authorId: string;
    authorName: string;
    authorUsername: string;
    profilePicture: {
      id: string;
      url: string;
      width: number;
      height: number;
    } | null;
    created_at: string;
    updated_at: string;
  }[],
) {
  const replyMap = new Map<string, unknown>();
  const rootReplies: unknown[] = [];

  // First pass: create all reply objects
  for (const reply of replies) {
    const replyObj = {
      id: reply.id,
      content: reply.content,
      depth: reply.depth,
      author: {
        id: reply.authorId,
        name: reply.authorName,
        username: reply.authorUsername,
        profile_picture: reply.profilePicture,
      },
      created_at: reply.created_at,
      updated_at: reply.updated_at,
      replies: [] as unknown[],
    };
    replyMap.set(reply.id, replyObj);
  }

  // Second pass: build tree structure
  for (const reply of replies) {
    const replyObj = replyMap.get(reply.id);
    if (reply.inReplyToId) {
      const parent = replyMap.get(reply.inReplyToId);
      if (parent && typeof parent === "object" && "replies" in parent) {
        (parent.replies as unknown[]).push(replyObj);
      }
    } else {
      rootReplies.push(replyObj);
    }
  }

  return rootReplies;
}

/**
 * Get replies for a community board post with nested structure
 */
export async function getCommunityBoardPostReplies(
  postId: string,
  limit: number = 20,
  cursor?: string,
) {
  // Validate post exists
  const post = await db.query.communityBoardPost.findFirst({
    where: and(
      eq(communityBoardPostTable.id, postId),
      isNull(communityBoardPostTable.deletedAt),
    ),
    with: {
      board: true,
    },
  });

  if (!post) {
    throw new AppException(
      404,
      CommunityBoardErrorCode.POST_NOT_FOUND,
      "Post not found",
    );
  }

  // Check if comments are allowed on this board
  if (!post.board.allowComments) {
    throw new AppException(
      403,
      CommunityBoardErrorCode.COMMENTS_DISABLED,
      "Comments are disabled for this board",
    );
  }

  // Get top-level replies (depth 0) with pagination
  const baseConditions = [
    eq(communityBoardPostReplyTable.postId, postId),
    eq(communityBoardPostReplyTable.depth, 0),
    isNull(communityBoardPostReplyTable.deletedAt),
  ];

  // Build query conditions (with cursor)
  const queryConditions = [...baseConditions];
  if (cursor) {
    queryConditions.push(gt(communityBoardPostReplyTable.id, cursor));
  }

  // Run count and data queries in parallel
  const [topLevelReplies, totalCountResult] = await Promise.all([
    db
      .select()
      .from(communityBoardPostReplyTable)
      .leftJoin(
        profileTable,
        eq(communityBoardPostReplyTable.authorId, profileTable.id),
      )
      .where(and(...queryConditions))
      .orderBy(asc(communityBoardPostReplyTable.id))
      .limit(limit + 1),
    db
      .select({ count: count() })
      .from(communityBoardPostReplyTable)
      .where(and(...baseConditions)),
  ]);

  const totalCount = totalCountResult[0]?.count ?? 0;
  const hasMore = topLevelReplies.length > limit;
  const repliesToReturn = hasMore
    ? topLevelReplies.slice(0, limit)
    : topLevelReplies;
  const nextCursor =
    hasMore && repliesToReturn.length > 0
      ? repliesToReturn[repliesToReturn.length - 1]?.community_board_post_reply
          ?.id || null
      : null;

  // Get all nested replies for these top-level replies
  const topLevelIds = repliesToReturn
    .map((r) => r.community_board_post_reply?.id)
    .filter((id): id is string => id !== undefined && id !== null);

  if (topLevelIds.length === 0) {
    return {
      data: [],
      pagination: {
        next_cursor: null,
        has_more: false,
        total_count: totalCount,
      },
    };
  }

  // Get all nested replies (depth > 0) for these top-level replies
  const nestedReplies = await db
    .select()
    .from(communityBoardPostReplyTable)
    .leftJoin(
      profileTable,
      eq(communityBoardPostReplyTable.authorId, profileTable.id),
    )
    .where(
      and(
        inArray(communityBoardPostReplyTable.rootReplyId, topLevelIds),
        isNull(communityBoardPostReplyTable.deletedAt),
      ),
    )
    .orderBy(communityBoardPostReplyTable.createdAt);

  // Collect all profile IDs for batch loading profile pictures
  const allProfileIds = [
    ...repliesToReturn
      .map((r) => r.profile?.id)
      .filter((id): id is string => !!id),
    ...nestedReplies
      .map((r) => r.profile?.id)
      .filter((id): id is string => !!id),
  ];

  // Batch load profile pictures
  const profilePictures =
    allProfileIds.length > 0
      ? await db.query.profilePicture.findMany({
          where: and(
            inArray(profilePictureTable.profileId, allProfileIds),
            isNull(profilePictureTable.deletedAt),
          ),
          with: {
            image: true,
          },
        })
      : [];

  // Create profile picture map
  const profilePictureMap = new Map<
    string,
    { id: string; url: string; width: number; height: number }
  >();
  for (const pp of profilePictures) {
    if (pp.image && !profilePictureMap.has(pp.profileId)) {
      profilePictureMap.set(pp.profileId, {
        id: pp.image.id,
        url: addImageUrl(pp.image).url,
        width: pp.image.width,
        height: pp.image.height,
      });
    }
  }

  // Combine all replies
  const allReplies = [
    ...repliesToReturn.map((r) => ({
      id: r.community_board_post_reply?.id || "",
      content: r.community_board_post_reply?.content || "",
      inReplyToId: r.community_board_post_reply?.inReplyToId ?? null,
      depth: r.community_board_post_reply?.depth || 0,
      authorId: r.profile?.id || "",
      authorName: r.profile?.name || "",
      authorUsername: r.profile?.username || "",
      profilePicture: r.profile?.id
        ? profilePictureMap.get(r.profile.id) || null
        : null,
      created_at: r.community_board_post_reply?.createdAt || "",
      updated_at: r.community_board_post_reply?.updatedAt || "",
    })),
    ...nestedReplies.map((r) => ({
      id: r.community_board_post_reply?.id || "",
      content: r.community_board_post_reply?.content || "",
      inReplyToId: r.community_board_post_reply?.inReplyToId ?? null,
      depth: r.community_board_post_reply?.depth || 0,
      authorId: r.profile?.id || "",
      authorName: r.profile?.name || "",
      authorUsername: r.profile?.username || "",
      profilePicture: r.profile?.id
        ? profilePictureMap.get(r.profile.id) || null
        : null,
      created_at: r.community_board_post_reply?.createdAt || "",
      updated_at: r.community_board_post_reply?.updatedAt || "",
    })),
  ];

  const tree = buildReplyTree(allReplies);

  return {
    data: tree,
    pagination: {
      next_cursor: nextCursor,
      has_more: hasMore,
      total_count: totalCount,
    },
  };
}

/**
 * Create a reply to a community board post
 */
export async function createCommunityBoardPostReply(
  postId: string,
  authorId: string,
  content: string,
  inReplyToId?: string,
) {
  // Validate post exists and get board info
  const post = await db.query.communityBoardPost.findFirst({
    where: and(
      eq(communityBoardPostTable.id, postId),
      isNull(communityBoardPostTable.deletedAt),
    ),
    with: {
      board: true,
    },
  });

  if (!post) {
    throw new AppException(
      404,
      CommunityBoardErrorCode.POST_NOT_FOUND,
      "Post not found",
    );
  }

  // Check if comments are allowed
  if (!post.board.allowComments) {
    throw new AppException(
      403,
      CommunityBoardErrorCode.COMMENTS_DISABLED,
      "Comments are disabled for this board",
    );
  }

  // Validate profile exists
  const profile = await db.query.profile.findFirst({
    where: eq(profileTable.id, authorId),
  });

  if (!profile) {
    throw new AppException(
      404,
      CommunityBoardErrorCode.UNAUTHORIZED,
      "Profile not found",
    );
  }

  let depth = 0;
  let rootReplyId: string | null = null;

  // If replying to another reply, calculate depth and rootReplyId
  if (inReplyToId) {
    const parentReply = await db.query.communityBoardPostReply.findFirst({
      where: and(
        eq(communityBoardPostReplyTable.id, inReplyToId),
        isNull(communityBoardPostReplyTable.deletedAt),
      ),
    });

    if (!parentReply) {
      throw new AppException(
        404,
        CommunityBoardErrorCode.REPLY_NOT_FOUND,
        "Parent reply not found",
      );
    }

    // Validate parent belongs to same post
    if (parentReply.postId !== postId) {
      throw new AppException(
        400,
        CommunityBoardErrorCode.INVALID_REQUEST,
        "Parent reply does not belong to this post",
      );
    }

    depth = parentReply.depth + 1;
    rootReplyId =
      parentReply.depth === 0 ? parentReply.id : parentReply.rootReplyId;
  }

  // Create the reply
  const newReplyResult = await db
    .insert(communityBoardPostReplyTable)
    .values({
      postId,
      authorId,
      content,
      inReplyToId: inReplyToId || null,
      depth,
      rootReplyId,
    })
    .returning();

  const newReply = newReplyResult[0];
  if (!newReply) {
    throw new Error("Failed to create reply");
  }

  const profilePicture = await getProfilePicture(profile.id);

  return {
    id: newReply.id,
    content: newReply.content,
    depth: newReply.depth,
    in_reply_to_id: newReply.inReplyToId,
    author: {
      id: profile.id,
      name: profile.name,
      username: profile.username,
      profile_picture: profilePicture,
    },
    created_at: newReply.createdAt,
    updated_at: newReply.updatedAt,
  };
}

/**
 * Delete a community board post reply
 */
export async function deleteCommunityBoardPostReply(
  replyId: string,
  profileId: string,
) {
  const reply = await db.query.communityBoardPostReply.findFirst({
    where: and(
      eq(communityBoardPostReplyTable.id, replyId),
      isNull(communityBoardPostReplyTable.deletedAt),
    ),
  });

  if (!reply) {
    throw new AppException(
      404,
      CommunityBoardErrorCode.REPLY_NOT_FOUND,
      "Reply not found",
    );
  }

  // Check if profile is the author
  if (reply.authorId !== profileId) {
    throw new AppException(
      403,
      CommunityBoardErrorCode.NOT_REPLY_AUTHOR,
      "Only the author can delete this reply",
    );
  }

  // Soft-delete the reply
  await db
    .update(communityBoardPostReplyTable)
    .set({
      deletedAt: sql`NOW()`,
    })
    .where(eq(communityBoardPostReplyTable.id, replyId));

  // Cascade delete all descendant replies
  if (reply.depth === 0) {
    // This is a top-level reply, delete all descendants using root_reply_id
    await db
      .update(communityBoardPostReplyTable)
      .set({
        deletedAt: sql`NOW()`,
      })
      .where(
        and(
          eq(communityBoardPostReplyTable.rootReplyId, replyId),
          isNull(communityBoardPostReplyTable.deletedAt),
        ),
      );
  } else {
    // This is a nested reply, use recursive CTE to find all descendants
    await db.execute(sql`
      WITH RECURSIVE descendants AS (
        -- Base case: direct children
        SELECT id FROM community_board_post_reply
        WHERE in_reply_to_id = ${replyId} AND deleted_at IS NULL

        UNION ALL

        -- Recursive case: children of children
        SELECT cbpr.id FROM community_board_post_reply cbpr
        INNER JOIN descendants d ON cbpr.in_reply_to_id = d.id
        WHERE cbpr.deleted_at IS NULL
      )
      UPDATE community_board_post_reply
      SET deleted_at = NOW()
      WHERE id IN (SELECT id FROM descendants)
    `);
  }
}
