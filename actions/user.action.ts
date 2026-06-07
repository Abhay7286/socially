"use server"

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server"

export async function syncUser() {
    try {
        const { userId } = await auth()
        const user = await currentUser()

        if (!userId || !user) return

        const existingUser = await prisma.user.findUnique({
            where: {
                clerkId: userId
            }
        })

        if (existingUser) return existingUser

        const dbUser = await prisma.user.create({
            data: {
                clerkId: userId,
                name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
                username: user.username ?? user.emailAddresses[0].emailAddress.split("@")[0],
                email: user.emailAddresses[0].emailAddress,
                image: user.imageUrl,
            }
        })

        return dbUser;

    } catch (error) {
        console.error("Error syncing user:", error);
    }
}

export async function getUserByClerkId(clerkId: string) {
    return await prisma.user.findUnique({
        where: {
            clerkId,
        },
        include: {
            _count: {
                select: {
                    posts: true,
                    followers: true,
                    following: true,
                }
            }
        }
    })
}

export async function getDbUserId() {
    const { userId: clerkId } = await auth();
    if (!clerkId) return null;

    const user = await getUserByClerkId(clerkId);

    if (!user) throw new Error("User not found in database");

    return user.id;
}

export async function getRandomUsers() {
    try {
        const userId = await getDbUserId()
        if (!userId) return []

        const randomUsers = await prisma.user.findMany({
            where: {
                AND: [
                    {NOT: {id : userId}},
                    {NOT: {
                        followers: {
                            some: {
                                followerId: userId,
                            }
                        }
                    }}
                ]
            },

            select: {
                id: true,
                name: true,
                username: true,
                image: true,
                _count: {
                    select: {
                        followers: true,
                    }
                }
            },
            take: 3,
        })
        return randomUsers
    } catch (error) {
        console.error("Error fetching random users:", error)
        return [];
    }
}

export async function toggleFollow(targetUserId: string) {
    try {
        const userId = await getDbUserId();

        // Guard clause to handle null/unauthenticated users
        if (!userId) {
            return { success: false, error: "You must be logged in to follow users." };
        }

        if (userId === targetUserId) throw new Error("You cannot follow yourself");

        const existingFollow = await prisma.follows.findUnique({
            where: {
                followerId_followingId: {
                    followerId: userId,
                    followingId: targetUserId,
                }
            }
        });

        if (existingFollow) {
            await prisma.follows.delete({
                where: {
                    followerId_followingId: {
                        followerId: userId,
                        followingId: targetUserId,
                    }
                }
            });
        }else {
            await prisma.$transaction([
                prisma.follows.create({
                    data: {
                        followerId: userId,
                        followingId: targetUserId,
                    }
                }),

                prisma.notification.create({
                    data: {
                        userId: targetUserId,
                        type: "FOLLOW",
                        creatorId: userId,
                    }
                })
            ])
        }

        revalidatePath("/")
        return { success: true };
    } catch (error) {
        console.error("Error toggling follow:", error);
        return { success: false, error };
    } 
    
}