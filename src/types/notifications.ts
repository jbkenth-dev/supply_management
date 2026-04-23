export type AppNotification = {
  id: number
  type: string
  title: string
  message: string
  actionUrl: string
  metadata: Record<string, unknown>
  isRead: boolean
  createdAt: string
  readAt: string | null
  actorName: string
}

export type NotificationsResponse = {
  success: boolean
  notifications: AppNotification[]
  unreadCount: number
  message?: string
}
