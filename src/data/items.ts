export interface Item {
  itemCode: string
  name: string
  category: string
  quantity: number
  unit: string
  supplierId: string
  reorderLevel: number
  status: "In Stock" | "Low" | "Out"
  lastStockIn?: string
  lastStockOut?: string
  imageUrl?: string
  description?: string
}

export const items: Item[] = [
  {
    itemCode: "PPR-001",
    name: "A4 Bond Paper (80gsm)",
    category: "Bond Paper",
    quantity: 150,
    unit: "reams",
    supplierId: "SUP-DEPED-1",
    reorderLevel: 40,
    status: "In Stock",
    lastStockIn: "2026-02-01",
    lastStockOut: "2026-02-12",
    imageUrl: "/paper.png",
    description: "Premium A4 white bond paper, perfect for printing exams and handouts."
  },
  {
    itemCode: "PPR-002",
    name: "Legal Size Bond Paper",
    category: "Bond Paper",
    quantity: 85,
    unit: "reams",
    supplierId: "SUP-DEPED-1",
    reorderLevel: 20,
    status: "In Stock",
    lastStockIn: "2026-02-05",
    lastStockOut: "2026-02-10",
    imageUrl: "/paper.png",
    description: "High-quality legal size (8.5 x 13) bond paper for official school documents."
  },
  {
    itemCode: "PPR-003",
    name: "Spiral Notebooks (Blue)",
    category: "Notebooks",
    quantity: 500,
    unit: "pcs",
    supplierId: "SUP-DEPED-1",
    reorderLevel: 100,
    status: "In Stock",
    lastStockIn: "2026-01-25",
    lastStockOut: "2026-02-10",
    imageUrl: "/paper.png",
    description: "Single-subject spiral notebooks with 80 ruled pages for students."
  },
  {
    itemCode: "PPR-004",
    name: "Yellow Pad Paper",
    category: "Writing Pads",
    quantity: 200,
    unit: "pads",
    supplierId: "SUP-OFFICE-MAX",
    reorderLevel: 50,
    status: "In Stock",
    lastStockIn: "2026-02-10",
    lastStockOut: "2026-02-13",
    imageUrl: "/paper.png",
    description: "Standard yellow ruled legal pads for student essays and faculty notes."
  },
  {
    itemCode: "PPR-005",
    name: "Construction Paper (Assorted)",
    category: "Art Paper",
    quantity: 60,
    unit: "packs",
    supplierId: "SUP-DEPED-2",
    reorderLevel: 15,
    status: "In Stock",
    lastStockIn: "2026-02-01",
    lastStockOut: "2026-02-11",
    imageUrl: "/paper.png",
    description: "Vibrant multi-color construction paper for arts and classroom decorations."
  },
  {
    itemCode: "PPR-006",
    name: "Graph Paper Pads",
    category: "Writing Pads",
    quantity: 45,
    unit: "pads",
    supplierId: "SUP-DEPED-2",
    reorderLevel: 10,
    status: "In Stock",
    lastStockIn: "2026-01-15",
    lastStockOut: "2026-02-01",
    imageUrl: "/paper.png",
    description: "Precision graph paper for mathematics, geometry, and engineering classes."
  },
  {
    itemCode: "PPR-007",
    name: "Manila Folders (Letter)",
    category: "Filing",
    quantity: 12,
    unit: "boxes",
    supplierId: "SUP-OFFICE-MAX",
    reorderLevel: 5,
    status: "In Stock",
    lastStockIn: "2026-02-05",
    lastStockOut: "2026-02-11",
    imageUrl: "/paper.png",
    description: "Heavy-duty manila folders for organizing student records and faculty files."
  },
  {
    itemCode: "PPR-008",
    name: "Index Cards (3x5)",
    category: "Filing",
    quantity: 150,
    unit: "packs",
    supplierId: "SUP-DEPED-1",
    reorderLevel: 30,
    status: "In Stock",
    lastStockIn: "2026-02-08",
    lastStockOut: "2026-02-13",
    imageUrl: "/paper.png",
    description: "Ruled index cards for study aids, speech notes, and library cataloging."
  }
]
