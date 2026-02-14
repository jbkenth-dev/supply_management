export default function RoleBadge({ role }: { role: "Admin" | "Manager" | "Staff" }) {
  const map = {
    Admin: "bg-purple-50 text-purple-700 ring-purple-600/20",
    Manager: "bg-blue-50 text-blue-700 ring-blue-600/20",
    Staff: "bg-slate-50 text-slate-700 ring-slate-600/20",
  }
  return <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs ring-1 ring-inset ${map[role]}`}>{role}</span>
}
