import MessageCenter from "../../components/messages/MessageCenter"
import { getStoredAuthUser } from "../../lib/auth"

export default function ApprovalPersonnelMessages() {
  const authUser = getStoredAuthUser()
  return <MessageCenter role={authUser?.role ?? "Resource Planning Officer"} />
}