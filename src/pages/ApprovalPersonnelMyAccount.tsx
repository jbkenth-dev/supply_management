import AccountPage from "../components/account/AccountPage"
import { getStoredAuthUser } from "../lib/auth"

export default function ApprovalPersonnelMyAccount() {
  const user = getStoredAuthUser()
  const role = (user?.role ?? "Resource Planning Officer") as "Resource Planning Officer" | "Vice President for Finance" | "College President"
  return <AccountPage role={role} />
}
