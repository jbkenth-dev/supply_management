import type { HTMLAttributes } from "react"

export default function Skeleton({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`animate-pulse rounded-md bg-gray-200 ${className}`} {...rest} />
}
