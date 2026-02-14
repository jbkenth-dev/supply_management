import { useState } from "react"
import AppShell from "../layout/AppShell"
import { items } from "../data/items"

export default function StockOut() {
  const [form, setForm] = useState({
    itemCode: items[0].itemCode,
    quantity: 0,
    unit: items[0].unit,
    reference: "",
    requestedBy: "",
  })

  return (
    <AppShell>
      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-3 text-sm font-medium text-gray-700">Record Stock Out</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-700">Item</label>
            <select
              value={form.itemCode}
              onChange={(e) => {
                const code = e.target.value
                const item = items.find((i) => i.itemCode === code)!
                setForm({ ...form, itemCode: code, unit: item.unit })
              }}
              className="mt-1 w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {items.map((i) => (
                <option key={i.itemCode} value={i.itemCode}>
                  {i.itemCode} • {i.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Quantity</label>
            <input
              type="number"
              min={0}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
              className="mt-1 w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Unit</label>
            <input value={form.unit} readOnly className="mt-1 w-full rounded-md border-gray-300 bg-gray-50 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Reference</label>
            <input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="WO / SO"
              className="mt-1 w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700">Requested By</label>
            <input
              value={form.requestedBy}
              onChange={(e) => setForm({ ...form, requestedBy: e.target.value })}
              placeholder="Department / Cost center"
              className="mt-1 w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="mt-4">
          <button className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Save</button>
          <span className="ml-3 text-xs text-gray-600">UI only</span>
        </div>
      </div>
    </AppShell>
  )
}
