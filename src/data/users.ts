export type User = {
  id: string
  name: string
  email: string
  role: "Administrator" | "Property Custodian" | "Faculty Staff"
  status: "Active" | "Disabled"
}

export const users: User[] = [
  { id: "USR-001", name: "Samuel Ortiz", email: "samuel.ortiz@sfc-g.com", role: "Administrator", status: "Active" },
  { id: "USR-002", name: "Fatima Ali", email: "fatima.ali@sfc-g.com", role: "Property Custodian", status: "Active" },
  { id: "USR-003", name: "Chris Johnson", email: "chris.johnson@sfc-g.com", role: "Faculty Staff", status: "Active" },
  { id: "USR-004", name: "Liu Wei", email: "liu.wei@sfc-g.com", role: "Faculty Staff", status: "Disabled" },
]
