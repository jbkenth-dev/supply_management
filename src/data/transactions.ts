export type Transaction = {
  id: string
  type: "IN" | "OUT"
  itemCode: string
  quantity: number
  unit: string
  date: string
  reference: string
  requestedBy?: string
  notes?: string
  status?: "Pending" | "Approved" | "Rejected"
}

export const transactions: Transaction[] = [
  {
    id: "TX-20260208-001",
    type: "OUT",
    itemCode: "PPR-001",
    quantity: 8,
    unit: "reams",
    date: "2026-02-08",
    reference: "SO-11983",
    requestedBy: "Sales Ops",
    status: "Approved"
  },
  {
    id: "TX-20260208-002",
    type: "OUT",
    itemCode: "PPR-002",
    quantity: 15,
    unit: "reams",
    date: "2026-02-08",
    reference: "WO-82711",
    requestedBy: "Assembly Line A",
    status: "Pending"
  },
  {
    id: "TX-20260206-001",
    type: "IN",
    itemCode: "PPR-003",
    quantity: 60,
    unit: "pcs",
    date: "2026-02-06",
    reference: "PO-55321",
    notes: "Delivered to central stores",
    status: "Approved"
  },
  {
    id: "TX-20260205-001",
    type: "IN",
    itemCode: "PPR-004",
    quantity: 100,
    unit: "pads",
    date: "2026-02-05",
    reference: "PO-55290",
    status: "Approved"
  },
  {
    id: "TX-20260202-001",
    type: "OUT",
    itemCode: "PPR-005",
    quantity: 20,
    unit: "packs",
    date: "2026-02-02",
    reference: "WO-82310",
    status: "Rejected"
  },
]
