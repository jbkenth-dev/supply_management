export type SupplyCategory = {
  id: number
  name: string
  supplyCount: number
}

export type SupplyItem = {
  id: number
  categoryId: number
  categoryName: string
  itemCode: string
  name: string
  description: string
  imagePath: string
  quantityOnHand: number
  createdAt: string | null
  updatedAt: string | null
}

export type StockEntry = {
  id: number
  supplyId: number
  supplyItemCode: string
  supplyName: string
  categoryName: string
  quantity: number
  referenceNo: string | null
  remarks: string | null
  createdByName: string
  createdAt: string
}
