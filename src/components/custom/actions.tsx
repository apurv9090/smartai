import { Button } from "@/components/ui/button"
import { Copy, ThumbsUp, ThumbsDown, Check } from 'lucide-react'
import { useState } from "react"
import { message } from "../../interfaces/interfaces"

interface MessageActionsProps {
  message: message
}

export function MessageActions({ message }: MessageActionsProps) {
  const [copied, setCopied] = useState(false)
  const [liked, setLiked] = useState(false)
  const [disliked, setDisliked] = useState(false)
  // Emoji reactions removed per request; keeping copy/like/dislike only

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLike = () => {
    console.log("like")
    console.log(message.id)
    
    setLiked(!liked)
    setDisliked(false)
  }

  const handleDislike = () => {
    console.log("dislike")
    console.log(message.id)

    setDisliked(!disliked)
    setLiked(false)
  }

  return (
    <div className="mt-2 flex items-center gap-1 opacity-0 group-hover/message:opacity-100 transition-opacity duration-200">
      {/* Utilities */}
      <div className="ml-auto flex items-center gap-1 rounded-full border bg-muted/60 backdrop-blur px-0.5">
        <Button variant="ghost" size="icon" onClick={handleCopy} className="h-7 w-7">
          {copied ? (
              <Check className="text-black dark:text-white" size={16} />
          ) : (
              <Copy className="text-gray-500" size={16} />
          )}
        </Button>
        <Button variant="ghost" size="icon" onClick={handleLike} className="h-7 w-7">
          <ThumbsUp className={liked ? "text-black dark:text-white" : "text-gray-500"} size={16} />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleDislike} className="h-7 w-7">
          <ThumbsDown className={disliked ? "text-black dark:text-white" : "text-gray-500"} size={16} />
        </Button>
      </div>
    </div>
  )
}