"use client"

import {toggleFollow} from "@/actions/user.action";
import { useState } from "react";
import { Button } from "./ui/button";
import toast  from "react-hot-toast";
import {Loader2Icon} from "lucide-react";

function FollowButton({ userId }: { userId: string }   ) {
  const [isLoading, setIsLoading] = useState(false);

  const handleFollow = async () => {
    setIsLoading(true);

    try {
      await toggleFollow(userId);
      toast.success("User Followed Successfully!");
    } catch (error) {
      toast.error("Failed to follow user.");
    } finally {
      setIsLoading(false);
    }
  }
  return (
    <Button onClick={handleFollow} disabled={isLoading} variant={"secondary"} size="sm" className="w-20">
      {isLoading ? <Loader2Icon className="animate-spin size-4" /> : "Follow"}
    </Button>
  )
}

export default FollowButton
