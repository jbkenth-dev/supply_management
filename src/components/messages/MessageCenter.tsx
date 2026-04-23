import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import {
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline"
import AppShell from "../../layout/AppShell"
import { getStoredAuthUser, type AuthRole } from "../../lib/auth"

type MessageContact = {
  id: number
  name: string
  role: string
  email: string
  username: string
  profileImageUrl: string | null
  lastMessage: string | null
  lastMessageAt: string | null
  lastMessageSenderId: number | null
  unreadCount: number
}

type MessageItem = {
  id: number
  senderUserId: number
  recipientUserId: number
  body: string
  isRead: boolean
  readAt: string | null
  createdAt: string
}

type MessageApiResponse = {
  success: boolean
  contacts: MessageContact[]
  messages: MessageItem[]
  selectedConversationUserId: number | null
  typing?: {
    isTyping: boolean
    updatedAt: string | null
  }
  message?: string
}

export default function MessageCenter({ role }: { role: AuthRole }) {
  const [authUser] = useState(() => getStoredAuthUser())
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [contacts, setContacts] = useState<MessageContact[]>([])
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [selectedConversationUserId, setSelectedConversationUserId] = useState<number | null>(null)
  const [draft, setDraft] = useState("")
  const [isContactTyping, setIsContactTyping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesViewportRef = useRef<HTMLDivElement | null>(null)
  const lastTypingStateRef = useRef(false)
  const shouldStickToBottomRef = useRef(true)
  const previousMessageCountRef = useRef(0)

  const filteredContacts = (() => {
    const term = searchTerm.trim().toLowerCase()
    const prioritizedContacts = [...contacts].sort((left, right) => {
      const shouldPrioritizeAdmin = role === "Faculty Staff" || role === "Property Custodian"

      if (!shouldPrioritizeAdmin) {
        return 0
      }

      const leftIsAdmin = left.role === "Administrator"
      const rightIsAdmin = right.role === "Administrator"

      if (leftIsAdmin === rightIsAdmin) {
        return 0
      }

      return leftIsAdmin ? -1 : 1
    })

    if (term === "") {
      return prioritizedContacts
    }

    return prioritizedContacts.filter((contact) =>
      [contact.name, contact.role, contact.email, contact.username].some((value) =>
        value.toLowerCase().includes(term)
      )
    )
  })()

  const selectedContact = contacts.find((contact) => contact.id === selectedConversationUserId) ?? null

  useEffect(() => {
    if (!authUser) {
      return
    }

    let cancelled = false

    const loadMessages = async (preferredConversationUserId?: number | null, showLoading = false) => {
      if (showLoading) {
        setLoading(true)
      }

      try {
        const conversationId = preferredConversationUserId ?? selectedConversationUserId
        const params = new URLSearchParams({
          userId: String(authUser.id),
        })

        if (conversationId) {
          params.set("conversationUserId", String(conversationId))
        }

        const response = await fetch(`/api/messages.php?${params.toString()}`)
        const result = (await response.json()) as MessageApiResponse

        if (!response.ok || !result.success) {
          throw new Error(result.message ?? "Unable to load messages.")
        }

        if (cancelled) {
          return
        }

        setContacts(result.contacts ?? [])
        setMessages(result.messages ?? [])
        setSelectedConversationUserId(result.selectedConversationUserId ?? null)
        setIsContactTyping(Boolean(result.typing?.isTyping))
        setError(null)
      } catch (fetchError) {
        if (cancelled) {
          return
        }

        setError(fetchError instanceof Error ? fetchError.message : "Unable to load messages.")
      } finally {
        if (!cancelled && showLoading) {
          setLoading(false)
        }
      }
    }

    void loadMessages(selectedConversationUserId, true)

    const intervalId = window.setInterval(() => {
      void loadMessages(selectedConversationUserId)
    }, 1000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [authUser, selectedConversationUserId])

  useEffect(() => {
    const container = messagesViewportRef.current

    if (!container) {
      return
    }

    const hasNewMessage = messages.length > previousMessageCountRef.current
    previousMessageCountRef.current = messages.length

    if (!hasNewMessage && !isContactTyping) {
      return
    }

    if (!shouldStickToBottomRef.current && !sending) {
      return
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: hasNewMessage ? "smooth" : "auto",
    })
  }, [isContactTyping, messages, sending])

  useEffect(() => {
    const container = messagesViewportRef.current

    if (!container) {
      return
    }

    const handleScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
      shouldStickToBottomRef.current = distanceFromBottom < 80
    }

    handleScroll()
    container.addEventListener("scroll", handleScroll)

    return () => {
      container.removeEventListener("scroll", handleScroll)
    }
  }, [selectedConversationUserId])

  useEffect(() => {
    if (!authUser || !selectedConversationUserId) {
      return
    }

    const nextTypingState = draft.trim().length > 0

    const syncTyping = async (isTyping: boolean) => {
      try {
        await fetch("/api/messages.php", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "typing",
            senderUserId: authUser.id,
            recipientUserId: selectedConversationUserId,
            isTyping,
          }),
        })
      } catch {
        // Typing status is best-effort and should not interrupt messaging.
      }
    }

    if (lastTypingStateRef.current !== nextTypingState) {
      lastTypingStateRef.current = nextTypingState
      void syncTyping(nextTypingState)
    }
  }, [authUser, draft, selectedConversationUserId])

  useEffect(() => {
    return () => {
      if (authUser && selectedConversationUserId && lastTypingStateRef.current) {
        void fetch("/api/messages.php", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "typing",
            senderUserId: authUser.id,
            recipientUserId: selectedConversationUserId,
            isTyping: false,
          }),
        })
      }
    }
  }, [authUser, selectedConversationUserId])

  const latestReadMessageId = (() => {
    const outgoingReadMessages = messages.filter(
      (message) => message.senderUserId === authUser?.id && message.isRead
    )

    return outgoingReadMessages.length > 0 ? outgoingReadMessages[outgoingReadMessages.length - 1].id : null
  })()

  const handleSelectConversation = (contactId: number) => {
    setSelectedConversationUserId(contactId)
    setIsContactTyping(false)
    setError(null)
  }

  const handleSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!authUser || !selectedConversationUserId || !draft.trim()) {
      return
    }

    setSending(true)

    try {
      const response = await fetch("/api/messages.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          senderUserId: authUser.id,
          recipientUserId: selectedConversationUserId,
          body: draft.trim(),
        }),
      })

      const result = (await response.json()) as { success: boolean; message?: string }

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to send your message.")
      }

      setDraft("")
      setError(null)
      setIsContactTyping(false)
      lastTypingStateRef.current = false

      const params = new URLSearchParams({
        userId: String(authUser.id),
        conversationUserId: String(selectedConversationUserId),
      })
      const refreshResponse = await fetch(`/api/messages.php?${params.toString()}`)
      const refreshResult = (await refreshResponse.json()) as MessageApiResponse

      if (!refreshResponse.ok || !refreshResult.success) {
        throw new Error(refreshResult.message ?? "Message sent, but refresh failed.")
      }

      setContacts(refreshResult.contacts ?? [])
      setMessages(refreshResult.messages ?? [])
      setSelectedConversationUserId(refreshResult.selectedConversationUserId ?? selectedConversationUserId)
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send your message.")
    } finally {
      setSending(false)
    }
  }

  return (
    <AppShell role={role}>
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-5">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">Message Center</p>
        </div>

        <div className="grid min-h-[72vh] lg:grid-cols-[22rem_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-100 p-4">
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search users"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="max-h-[65vh] overflow-y-auto lg:max-h-[calc(72vh-81px)]">
              {loading ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="animate-pulse rounded-2xl border border-slate-100 p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-full bg-slate-200" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-32 rounded-full bg-slate-200" />
                          <div className="h-3 w-40 rounded-full bg-slate-100" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-slate-300" />
                  <p className="mt-4 text-sm font-semibold text-slate-900">No users found</p>
                  <p className="mt-2 text-sm text-slate-500">Create more accounts to start messaging across roles.</p>
                </div>
              ) : (
                filteredContacts.map((contact) => {
                  const isActive = contact.id === selectedConversationUserId

                  return (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => handleSelectConversation(contact.id)}
                      className={`block w-full border-b border-slate-100 px-4 py-4 text-left transition hover:bg-slate-50 ${
                        isActive ? "bg-blue-50/70" : "bg-white"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar contact={contact} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className={`truncate text-sm font-bold ${isActive ? "text-blue-700" : "text-slate-900"}`}>
                                {contact.name}
                              </p>
                              <p className="mt-0.5 text-xs font-medium text-slate-500">{contact.role}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[11px] font-medium text-slate-400">
                                {formatContactTime(contact.lastMessageAt)}
                              </p>
                              {contact.unreadCount > 0 ? (
                                <span className="mt-1 inline-flex min-w-6 items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                                  {contact.unreadCount}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <p className="mt-2 truncate text-xs text-slate-500">
                            <span className={contact.unreadCount > 0 ? "font-bold text-slate-900" : ""}>
                              {contact.lastMessage ?? `Start a conversation with ${contact.name}.`}
                            </span>
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </aside>

          <section className="flex h-[78vh] min-h-[55vh] flex-col bg-slate-50/60">
            {selectedContact ? (
              <>
                <div className="flex items-center gap-4 border-b border-slate-200 bg-white px-6 py-4">
                  <Avatar contact={selectedContact} />
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-slate-900">{selectedContact.name}</p>
                    <p className="text-sm text-slate-500">{selectedContact.role}</p>
                  </div>
                </div>

                <div ref={messagesViewportRef} className="h-full flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
                  {messages.length === 0 ? (
                    <div className="flex h-full min-h-64 items-center justify-center">
                      <div className="max-w-sm rounded-[2rem] border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
                        <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-slate-300" />
                        <p className="mt-4 text-sm font-semibold text-slate-900">No messages yet</p>
                        <p className="mt-2 text-sm text-slate-500">
                          Send the first message to begin this conversation.
                        </p>
                      </div>
                    </div>
                  ) : (
                    messages.map((message) => {
                      const isCurrentUser = message.senderUserId === authUser?.id
                      const showReadAvatar = isCurrentUser && message.id === latestReadMessageId

                      return (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}
                        >
                          <div className={`inline-flex max-w-[78%] flex-col ${isCurrentUser ? "items-end" : "items-start"}`}>
                            <div
                              className={`rounded-[1.5rem] px-4 py-3 text-sm leading-6 shadow-sm ${
                                isCurrentUser
                                  ? "rounded-br-md bg-blue-600 text-white"
                                  : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
                              }`}
                            >
                              {message.body}
                            </div>
                            <div
                              className={`mt-1 flex items-center gap-2 px-1 ${
                                isCurrentUser ? "self-end justify-end" : "self-start justify-start"
                              }`}
                            >
                              <p className="text-[11px] font-medium text-slate-400">
                                {formatMessageDate(message.createdAt)}
                                {isCurrentUser && !message.isRead ? " - Sent" : ""}
                              </p>
                              {showReadAvatar && selectedContact ? (
                                <div
                                  className="flex h-4 w-4 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white"
                                  title={`${selectedContact.name} has read this message`}
                                >
                                  {selectedContact.profileImageUrl ? (
                                    <img
                                      src={selectedContact.profileImageUrl}
                                      alt={selectedContact.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <UserCircleIcon className="h-2.5 w-2.5 text-slate-400" />
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </motion.div>
                      )
                    })
                  )}
                  {isContactTyping && selectedContact ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-start"
                    >
                      <div className="flex max-w-[78%] items-end gap-3">
                        <Avatar contact={selectedContact} />
                        <div className="rounded-[1.5rem] rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                          <div className="flex items-center gap-1">
                            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </div>

                <div className="border-t border-slate-200 bg-white p-4 sm:p-5">
                  <form onSubmit={handleSendMessage} className="space-y-3">
                    <div className="flex items-end gap-3">
                      <textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder={`Message ${selectedContact.name}`}
                        rows={3}
                        className="min-h-[56px] flex-1 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                      />
                      <button
                        type="submit"
                        disabled={sending || !draft.trim()}
                        className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                      >
                        <PaperAirplaneIcon className="h-5 w-5" />
                      </button>
                    </div>
                    {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
                  </form>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center px-6">
                <div className="max-w-md text-center">
                  <ChatBubbleLeftRightIcon className="mx-auto h-14 w-14 text-slate-300" />
                  <p className="mt-4 text-lg font-bold text-slate-900">Choose a conversation</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Select a faculty, custodian, or admin account from the left panel to view and send live messages.
                  </p>
                  {error ? <p className="mt-3 text-sm font-medium text-rose-600">{error}</p> : null}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  )
}

function Avatar({ contact }: { contact: Pick<MessageContact, "name" | "profileImageUrl"> }) {
  if (contact.profileImageUrl) {
    return (
      <img
        src={contact.profileImageUrl}
        alt={contact.name}
        className="h-11 w-11 rounded-full border border-slate-200 object-cover shadow-sm"
      />
    )
  }

  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-500 shadow-sm">
      <UserCircleIcon className="h-7 w-7" />
    </div>
  )
}

function formatContactTime(value: string | null) {
  if (!value) {
    return ""
  }

  const date = new Date(value.replace(" ", "T"))

  if (Number.isNaN(date.getTime())) {
    return value
  }

  const now = new Date()
  const isSameDay = now.toDateString() === date.toDateString()

  return isSameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" })
}

function formatMessageDate(value: string) {
  const date = new Date(value.replace(" ", "T"))

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
