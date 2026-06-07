"use server"

import { prisma } from "@/lib/prisma";
import { getDbUserId } from "./user.action";
import { revalidatePath } from "next/cache";

export async function createPost(content: string, image: string) {
    try {
        const userId = await getDbUserId()

        if (!userId) return { success: false, error: "Unauthorized" };

        const post = await prisma.post.create({
            data: {
                content,
                image,
                authorId: userId,
            },
        })

        revalidatePath("/")
        return { success: true, post }

    } catch (error) {
        console.error("Error creating post:", error)
        return { success: false, error: "Failed to create post" }
    }
}

export async function getPosts() {
    try {
        const posts = await prisma.post.findMany({
            orderBy: {
                createdAt: "desc", 
            },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                        username: true,
                    },
                },
                comments: {
                    include: {
                        author: {
                            select: {
                                id: true,
                                image: true,
                                name: true,
                                username: true,
                            }
                        }
                    },
                    orderBy: {
                        createdAt: "desc", 
                    },
                },
                likes: {
                    select: {
                        userId: true,
                    }
                },
                _count: {
                    select: {
                        likes: true,
                        comments: true,
                    }
                }
            }
        })
        return posts

    } catch (error) {
        console.error("Error fetching posts:", error)
        return []
    }
}

export async function toggleLike(postId: string) {
    try {
        const userId = await getDbUserId()
        if (!userId) return 

        const existingLike = await prisma.like.findUnique({
            where: {
                userId_postId: {
                    userId,
                    postId, 
                }
            }
    });

    const post = await prisma.post.findUnique({
        where: { id: postId },
        select: {authorId: true},
    })

    if (existingLike) {
        await prisma.like.delete({
            where: {
                userId_postId: {
                    userId,
                    postId,
                }
            }
        })
    } else{
        if (!post) return { success: false, error: "Post not found" }

        await prisma.$transaction([
            prisma.like.create({
                data: {
                    userId,
                    postId,
                }
            }),
            ...(post.authorId !== userId ? [prisma.notification.create({
                data: {
                  userId: post.authorId, // Recipient (The post owner)
                  creatorId: userId,     // Actor (The person liking the post)
                  postId,
                  type: "LIKE",
                },
            })] : [])
        ])
    }

    revalidatePath("/")
    return { success: true }
    } catch (error) {
        console.error("Error toggling like:", error)
        return { success: false, error: "Failed to toggle like" }
    }
}

export async function deletePost(postId: string){
    try {
        const userId = await getDbUserId()
        const post = await prisma.post.findUnique({
            where: { id: postId },
            select: { authorId: true },
        })

        if (!post) return { success: false, error: "Post not found" }
        if (post.authorId !== userId) return { success: false, error: "Unauthorized" }

        await prisma.post.delete({
            where: { id: postId },
        })
        revalidatePath("/")
        return { success: true }

    }catch (error) {
        console.error("Error deleting post:", error)
        return { success: false, error: "Failed to delete post" }
    }
}

export async function createComment(postId: string, content: string) {
  try {
    const userId = await getDbUserId();

    if (!userId) return;
    if (!content) throw new Error("Content is required");

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });

    if (!post) throw new Error("Post not found");

    // Create comment and notification in a transaction
    const [comment] = await prisma.$transaction(async (tx) => {
      // Create comment first
      const newComment = await tx.comment.create({
        data: {
          content,
          authorId: userId,
          postId,
        },
      });

      // Create notification if commenting on someone else's post
      if (post.authorId !== userId) {
        await tx.notification.create({
          data: {
            type: "COMMENT",
            userId: post.authorId,
            creatorId: userId,
            postId,
            commentId: newComment.id,
          },
        });
      }

      return [newComment];
    });

    revalidatePath(`/`);
    return { success: true, comment };
  } catch (error) {
    console.error("Failed to create comment:", error);
    return { success: false, error: "Failed to create comment" };
  }
}

