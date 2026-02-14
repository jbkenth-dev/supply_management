export type User = {
  id: string
  name: string
  email: string
  role: "Admin" | "Manager" | "Staff"
  status: "Active" | "Disabled"
}

export const users: User[] = [
  { id: "USR-001", name: "Samuel Ortiz", email: "samuel.ortiz@sfc-g.com", role: "Admin", status: "Active" },
  { id: "USR-002", name: "Fatima Ali", email: "fatima.ali@sfc-g.com", role: "Manager", status: "Active" },
  { id: "USR-003", name: "Chris Johnson", email: "chris.johnson@sfc-g.com", role: "Staff", status: "Active" },
  { id: "USR-004", name: "Liu Wei", email: "liu.wei@sfc-g.com", role: "Staff", status: "Disabled" },
]
