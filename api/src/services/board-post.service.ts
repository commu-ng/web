import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import {
  board as boardTable,
  boardHashtag as boardHashtagTable,
  boardPost as boardPostTable,
  boardPostHashtag as boardPostHashtagTable,
  image as imageTable,
  user as userTable,
} from "../drizzle/schema";
import { AppException } from "../exception";
import { BoardErrorCode } from "../types/api-responses";
import { addImageUrl } from "../utils/r2";

/**
 * Get all boards
 */
export async function getBoards() {
  const boards = await db.query.board.findMany({
    where: isNull(boardTable.deletedAt),
    orderBy: [desc(boardTable.createdAt)],
  });

  return boards.map((board) => ({
    id: board.id,
    name: board.name,
    slug: board.slug,
    description: board.description,
    created_at: board.createdAt,
    updated_at: board.updatedAt,
  }));
}

/**
 * Get a single board by ID
 */
export async function getBoard(boardId: string) {
  const board = await db.query.board.findFirst({
    where: and(eq(boardTable.id, boardId), isNull(boardTable.deletedAt)),
  });

  if (!board) {
    throw new AppException(
      404,
      BoardErrorCode.BOARD_NOT_FOUND,
      "Board not found",
    );
  }

  return {
    id: board.id,
    name: board.name,
    slug: board.slug,
    description: board.description,
    created_at: board.createdAt,
    updated_at: board.updatedAt,
  };
}

/**
 * Get a single board by slug
 */
export async function getBoardBySlug(slug: string) {
  const board = await db.query.board.findFirst({
    where: and(eq(boardTable.slug, slug), isNull(boardTable.deletedAt)),
  });

  if (!board) {
    throw new AppException(
      404,
      BoardErrorCode.BOARD_NOT_FOUND,
      "Board not found",
    );
  }

  return {
    id: board.id,
    name: board.name,
    slug: board.slug,
    description: board.description,
    created_at: board.createdAt,
    updated_at: board.updatedAt,
  };
}

/**
 * Create a new board
 */
export async function createBoard(
  name: string,
  slug: string,
  description: string | null | undefined,
) {
  // Check if slug already exists
  const existingBoard = await db.query.board.findFirst({
    where: eq(boardTable.slug, slug),
  });

  if (existingBoard) {
    throw new AppException(
      409,
      BoardErrorCode.DUPLICATE_BOARD_SLUG,
      "Board slug already exists",
    );
  }

  const newBoardResult = await db
    .insert(boardTable)
    .values({
      name,
      slug,
      description: description || null,
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
    created_at: newBoard.createdAt,
    updated_at: newBoard.updatedAt,
  };
}

/**
 * Update a board
 */
export async function updateBoard(
  boardId: string,
  name: string,
  slug: string,
  description: string | null | undefined,
) {
  // Check if board exists
  const board = await db.query.board.findFirst({
    where: and(eq(boardTable.id, boardId), isNull(boardTable.deletedAt)),
  });

  if (!board) {
    throw new AppException(
      404,
      BoardErrorCode.BOARD_NOT_FOUND,
      "Board not found",
    );
  }

  // Check if slug is taken by another board
  if (slug !== board.slug) {
    const existingBoard = await db.query.board.findFirst({
      where: eq(boardTable.slug, slug),
    });

    if (existingBoard && existingBoard.id !== boardId) {
      throw new AppException(
        409,
        BoardErrorCode.DUPLICATE_BOARD_SLUG,
        "Board slug already exists",
      );
    }
  }

  const updatedBoardResult = await db
    .update(boardTable)
    .set({
      name,
      slug,
      description: description || null,
      updatedAt: sql`NOW()`,
    })
    .where(eq(boardTable.id, boardId))
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
    created_at: updatedBoard.createdAt,
    updated_at: updatedBoard.updatedAt,
  };
}

/**
 * Delete a board
 */
export async function deleteBoard(boardId: string) {
  const board = await db.query.board.findFirst({
    where: and(eq(boardTable.id, boardId), isNull(boardTable.deletedAt)),
  });

  if (!board) {
    throw new AppException(
      404,
      BoardErrorCode.BOARD_NOT_FOUND,
      "Board not found",
    );
  }

  await db
    .update(boardTable)
    .set({
      deletedAt: sql`NOW()`,
    })
    .where(eq(boardTable.id, boardId));
}

/**
 * Get board posts with pagination
 */
export async function getBoardPosts(
  boardId: string | undefined,
  limit: number = 20,
  cursor?: string,
  hashtags?: string[],
) {
  const conditions = [isNull(boardPostTable.deletedAt)];

  if (boardId) {
    conditions.push(eq(boardPostTable.boardId, boardId));
  }

  if (cursor) {
    conditions.push(sql`${boardPostTable.id} < ${cursor}`);
  }

  // If hashtags filter is provided, filter posts that have ALL of the hashtags (AND logic)
  if (hashtags && hashtags.length > 0) {
    const normalizedHashtags = hashtags.map((tag) => tag.toLowerCase().trim());
    const postIdsWithAllHashtags = db
      .select({ postId: boardPostHashtagTable.boardPostId })
      .from(boardPostHashtagTable)
      .innerJoin(
        boardHashtagTable,
        eq(boardPostHashtagTable.hashtagId, boardHashtagTable.id),
      )
      .where(inArray(boardHashtagTable.tag, normalizedHashtags))
      .groupBy(boardPostHashtagTable.boardPostId)
      .having(
        sql`COUNT(DISTINCT ${boardHashtagTable.id}) = ${normalizedHashtags.length}`,
      );

    conditions.push(inArray(boardPostTable.id, postIdsWithAllHashtags));
  }

  const posts = await db
    .select()
    .from(boardPostTable)
    .leftJoin(userTable, eq(boardPostTable.authorId, userTable.id))
    .leftJoin(boardTable, eq(boardPostTable.boardId, boardTable.id))
    .where(and(...conditions))
    .orderBy(desc(boardPostTable.id))
    .limit(limit + 1);

  // Check if there are more results
  const hasMore = posts.length > limit;
  const postsToReturn = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor =
    hasMore && postsToReturn.length > 0
      ? postsToReturn[postsToReturn.length - 1]?.board_post?.id || null
      : null;

  // Collect all post IDs for batch loading hashtags and images
  const postIds = postsToReturn
    .map((row) => row.board_post?.id)
    .filter((id): id is string => id !== undefined && id !== null);

  const imageIds = postsToReturn
    .map((row) => row.board_post?.imageId)
    .filter((id): id is string => id !== undefined && id !== null);

  // Batch load hashtags and images
  const allHashtags =
    postIds.length > 0
      ? await db.query.boardPostHashtag.findMany({
          where: inArray(boardPostHashtagTable.boardPostId, postIds),
          with: {
            hashtag: true,
          },
        })
      : [];

  const allImages =
    imageIds.length > 0
      ? await db.query.image.findMany({
          where: inArray(imageTable.id, imageIds),
        })
      : [];

  // Group hashtags by post ID
  const hashtagsByPostId = new Map<string, typeof allHashtags>();
  allHashtags.forEach((h) => {
    if (!hashtagsByPostId.has(h.boardPostId)) {
      hashtagsByPostId.set(h.boardPostId, []);
    }
    hashtagsByPostId.get(h.boardPostId)?.push(h);
  });

  // Create image map
  const imageMap = new Map(allImages.map((img) => [img.id, img]));

  // Build result
  const result = postsToReturn
    .map((row) => {
      const post = row.board_post;
      const author = row.user;
      const board = row.board;

      if (!post || !author || !board) return null;

      const hashtags = hashtagsByPostId.get(post.id) || [];
      const image = post.imageId ? imageMap.get(post.imageId) : null;

      return {
        id: post.id,
        board: {
          id: board.id,
          name: board.name,
          slug: board.slug,
        },
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
        hashtags: hashtags.map((h) => ({
          id: h.hashtag.id,
          tag: h.hashtag.tag,
        })),
        author: {
          id: author.id,
          login_name: author.loginName,
        },
        created_at: post.createdAt,
        updated_at: post.updatedAt,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    data: result,
    nextCursor,
    hasMore,
  };
}

/**
 * Get a single board post
 */
export async function getBoardPost(postId: string) {
  const post = await db.query.boardPost.findFirst({
    where: and(eq(boardPostTable.id, postId), isNull(boardPostTable.deletedAt)),
    with: {
      board: true,
      user: true,
      image: true,
    },
  });

  if (!post) {
    throw new AppException(
      404,
      BoardErrorCode.BOARD_POST_NOT_FOUND,
      "Board post not found",
    );
  }

  // Get hashtags
  const hashtags = await db.query.boardPostHashtag.findMany({
    where: eq(boardPostHashtagTable.boardPostId, postId),
    with: {
      hashtag: true,
    },
  });

  return {
    id: post.id,
    board: {
      id: post.board.id,
      name: post.board.name,
      slug: post.board.slug,
    },
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
    hashtags: hashtags.map((h) => ({
      id: h.hashtag.id,
      tag: h.hashtag.tag,
    })),
    author: {
      id: post.user.id,
      login_name: post.user.loginName,
    },
    created_at: post.createdAt,
    updated_at: post.updatedAt,
  };
}

/**
 * Create a board post
 */
export async function createBoardPost(
  boardId: string,
  authorId: string,
  title: string,
  content: string,
  imageId: string | null | undefined,
  hashtags: string[] | undefined,
) {
  // Validate board exists
  const board = await db.query.board.findFirst({
    where: and(eq(boardTable.id, boardId), isNull(boardTable.deletedAt)),
  });

  if (!board) {
    throw new AppException(
      404,
      BoardErrorCode.BOARD_NOT_FOUND,
      "Board not found",
    );
  }

  // Validate user exists
  const user = await db.query.user.findFirst({
    where: eq(userTable.id, authorId),
  });

  if (!user) {
    throw new AppException(404, BoardErrorCode.UNAUTHORIZED, "User not found");
  }

  // Validate image if provided
  if (imageId) {
    const image = await db.query.image.findFirst({
      where: and(eq(imageTable.id, imageId), isNull(imageTable.deletedAt)),
    });

    if (!image) {
      throw new AppException(
        400,
        BoardErrorCode.INVALID_IMAGE,
        "Invalid image",
      );
    }
  }

  // Create post in a transaction
  const result = await db.transaction(async (tx) => {
    // Create the post
    const newPostResult = await tx
      .insert(boardPostTable)
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
      throw new Error("Failed to create board post");
    }

    // Handle hashtags
    if (hashtags && hashtags.length > 0) {
      // Get or create hashtags
      const hashtagRecords = await Promise.all(
        hashtags.map(async (tag) => {
          const normalizedTag = tag.toLowerCase().trim();

          // Try to find existing hashtag
          const existing = await tx.query.boardHashtag.findFirst({
            where: eq(boardHashtagTable.tag, normalizedTag),
          });

          if (existing) {
            return existing;
          }

          // Create new hashtag
          const newHashtagResult = await tx
            .insert(boardHashtagTable)
            .values({ tag: normalizedTag })
            .returning();

          return newHashtagResult[0];
        }),
      );

      // Link hashtags to post
      const hashtagLinks = hashtagRecords
        .filter(
          (h): h is NonNullable<typeof h> => h !== null && h !== undefined,
        )
        .map((hashtag) => ({
          boardPostId: newPost.id,
          hashtagId: hashtag.id,
        }));

      if (hashtagLinks.length > 0) {
        await tx.insert(boardPostHashtagTable).values(hashtagLinks);
      }
    }

    return newPost;
  });

  // Get the created post with all relations
  return getBoardPost(result.id);
}

/**
 * Update a board post
 */
export async function updateBoardPost(
  postId: string,
  authorId: string,
  title: string,
  content: string,
  imageId: string | null | undefined,
  hashtags: string[] | undefined,
) {
  // Check if post exists
  const post = await db.query.boardPost.findFirst({
    where: and(eq(boardPostTable.id, postId), isNull(boardPostTable.deletedAt)),
  });

  if (!post) {
    throw new AppException(
      404,
      BoardErrorCode.BOARD_POST_NOT_FOUND,
      "Board post not found",
    );
  }

  // Check if user is the author
  if (post.authorId !== authorId) {
    throw new AppException(
      403,
      BoardErrorCode.NOT_POST_AUTHOR,
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
        BoardErrorCode.INVALID_IMAGE,
        "Invalid image",
      );
    }
  }

  // Update post in a transaction
  await db.transaction(async (tx) => {
    // Update the post
    await tx
      .update(boardPostTable)
      .set({
        title,
        content,
        imageId: imageId || null,
        updatedAt: sql`NOW()`,
      })
      .where(eq(boardPostTable.id, postId));

    // Delete existing hashtags
    await tx
      .delete(boardPostHashtagTable)
      .where(eq(boardPostHashtagTable.boardPostId, postId));

    // Handle new hashtags
    if (hashtags && hashtags.length > 0) {
      // Get or create hashtags
      const hashtagRecords = await Promise.all(
        hashtags.map(async (tag) => {
          const normalizedTag = tag.toLowerCase().trim();

          // Try to find existing hashtag
          const existing = await tx.query.boardHashtag.findFirst({
            where: eq(boardHashtagTable.tag, normalizedTag),
          });

          if (existing) {
            return existing;
          }

          // Create new hashtag
          const newHashtagResult = await tx
            .insert(boardHashtagTable)
            .values({ tag: normalizedTag })
            .returning();

          return newHashtagResult[0];
        }),
      );

      // Link hashtags to post
      const hashtagLinks = hashtagRecords
        .filter(
          (h): h is NonNullable<typeof h> => h !== null && h !== undefined,
        )
        .map((hashtag) => ({
          boardPostId: postId,
          hashtagId: hashtag.id,
        }));

      if (hashtagLinks.length > 0) {
        await tx.insert(boardPostHashtagTable).values(hashtagLinks);
      }
    }
  });

  // Get the updated post
  return getBoardPost(postId);
}

/**
 * Delete a board post
 */
export async function deleteBoardPost(postId: string, userId: string) {
  const post = await db.query.boardPost.findFirst({
    where: and(eq(boardPostTable.id, postId), isNull(boardPostTable.deletedAt)),
  });

  if (!post) {
    throw new AppException(
      404,
      BoardErrorCode.BOARD_POST_NOT_FOUND,
      "Board post not found",
    );
  }

  // Check if user is the author or admin
  const user = await db.query.user.findFirst({
    where: eq(userTable.id, userId),
  });

  if (!user) {
    throw new AppException(404, BoardErrorCode.UNAUTHORIZED, "User not found");
  }

  // Only author or admin can delete
  if (post.authorId !== userId && !user.isAdmin) {
    throw new AppException(
      403,
      BoardErrorCode.FORBIDDEN,
      "Only the author or admin can delete this post",
    );
  }

  await db
    .update(boardPostTable)
    .set({
      deletedAt: sql`NOW()`,
    })
    .where(eq(boardPostTable.id, postId));
}

/**
 * Get top hashtags for a board
 */
export async function getBoardHashtags(boardId: string, limit: number = 30) {
  // Get all hashtags used in non-deleted posts for this board
  const hashtags = await db
    .select({
      tag: boardHashtagTable.tag,
      count:
        sql<number>`count(distinct ${boardPostHashtagTable.boardPostId})`.as(
          "count",
        ),
    })
    .from(boardHashtagTable)
    .innerJoin(
      boardPostHashtagTable,
      eq(boardHashtagTable.id, boardPostHashtagTable.hashtagId),
    )
    .innerJoin(
      boardPostTable,
      and(
        eq(boardPostHashtagTable.boardPostId, boardPostTable.id),
        eq(boardPostTable.boardId, boardId),
        isNull(boardPostTable.deletedAt),
      ),
    )
    .groupBy(boardHashtagTable.id, boardHashtagTable.tag)
    .orderBy(desc(sql`count`))
    .limit(limit);

  return hashtags.map((h) => h.tag);
}
