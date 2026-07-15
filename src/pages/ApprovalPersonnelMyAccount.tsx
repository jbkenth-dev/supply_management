import AccountPage from "../components/account/AccountPage"
import ApprovalPersonnelShell from "../layout/ApprovalPersonnelShell"
import { getStoredAuthUser } from "../lib/auth"

export default function ApprovalPersonnelMyAccount() {
  const user = getStoredAuthUser()
  const role = (user?.role ?? "Resource Planning Officer") as "Resource Planning Officer" | "Vice President for Finance" | "College President"
  return <AccountPage role={role} shell={ApprovalPersonnelShell} />
}
