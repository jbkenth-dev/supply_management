export default function RoleBadge({ role }: { role: "Administrator" | "Property Custodian" | "Faculty Staff" }) {
  const map = {
    Administrator: "bg-primary-50 text-primary-700 ring-primary-600/20",
    "Property Custodian": "bg-primary-50 text-primary-700 ring-primary-600/20",
    "Faculty Staff": "bg-brown-50 text-brown-700 ring-brown-600/20",
  }
  return <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs ring-1 ring-inset ${map[role]}`}>{role}</span>
}
