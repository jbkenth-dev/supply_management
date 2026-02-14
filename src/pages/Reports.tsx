import AppShell from "../layout/AppShell"
import { items } from "../data/items"
import { transactions } from "../data/transactions"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"

export default function Reports() {
  const valuationByCategory: Record<string, number> = {
    "Raw Materials": 750,
    Packaging: 1.2,
    Components: 0.5,
    "Finished Goods": 1200,
    Consumables: 3.4,
    Safety: 18,
  }

  const valuation = items.map((i) => ({
    item: i.itemCode,
    category: i.category,
    qty: i.quantity,
    unitPrice: valuationByCategory[i.category] ?? 1,
    value: (valuationByCategory[i.category] ?? 1) * i.quantity,
  }))

  const outCounts: Record<string, number> = {}
  transactions.forEach((t) => {
    if (t.type === "OUT") outCounts[t.itemCode] = (outCounts[t.itemCode] ?? 0) + t.quantity
  })
  const fastMoving = Object.entries(outCounts)
    .map(([itemCode, qty]) => ({ itemCode, qty }))
    .sort((a, b) => b.qty - a.qty)
  const slowMoving = items
    .map((i) => ({ itemCode: i.itemCode, qty: outCounts[i.itemCode] ?? 0 }))
    .sort((a, b) => a.qty - b.qty)

  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-medium text-gray-700">Inventory Valuation</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={valuation} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="item" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50">Export PDF</button>
            <button className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50">Export Excel</button>
            <span className="text-xs text-gray-600">UI only</span>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <h3 className="mb-3 text-sm font-medium text-gray-700">Fast-Moving Items</h3>
          <ul className="divide-y">
            {fastMoving.slice(0, 8).map((f) => (
              <li key={f.itemCode} className="flex items-center justify-between py-2">
                <p className="text-sm text-gray-800">{f.itemCode}</p>
                <p className="text-xs text-gray-600">{f.qty.toLocaleString()}</p>
              </li>
            ))}
            {fastMoving.length === 0 && <li className="py-2 text-sm text-gray-600">No data</li>}
          </ul>
          <h3 className="mt-6 mb-3 text-sm font-medium text-gray-700">Slow-Moving Items</h3>
          <ul className="divide-y">
            {slowMoving.slice(0, 8).map((s) => (
              <li key={s.itemCode} className="flex items-center justify-between py-2">
                <p className="text-sm text-gray-800">{s.itemCode}</p>
                <p className="text-xs text-gray-600">{s.qty.toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  )
}
