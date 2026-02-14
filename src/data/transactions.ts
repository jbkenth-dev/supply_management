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
}

export const transactions: Transaction[] = [
  {
    id: "TX-20260208-001",
    type: "OUT",
    itemCode: "FIN-312",
    quantity: 8,
    unit: "units",
    date: "2026-02-08",
    reference: "SO-11983",
    requestedBy: "Sales Ops",
  },
  {
    id: "TX-20260208-002",
    type: "OUT",
    itemCode: "CMP-221",
    quantity: 400,
    unit: "pcs",
    date: "2026-02-08",
    reference: "WO-82711",
    requestedBy: "Assembly Line A",
  },
  {
    id: "TX-20260206-001",
    type: "IN",
    itemCode: "SAF-101",
    quantity: 60,
    unit: "boxes",
    date: "2026-02-06",
    reference: "PO-55321",
    notes: "Delivered to central stores",
  },
  {
    id: "TX-20260205-001",
    type: "IN",
    itemCode: "PKG-010",
    quantity: 2000,
    unit: "pcs",
    date: "2026-02-05",
    reference: "PO-55290",
  },
  {
    id: "TX-20260202-001",
    type: "OUT",
    itemCode: "RM-001",
    quantity: 20,
    unit: "tons",
    date: "2026-02-02",
    reference: "WO-82310",
  },
]
