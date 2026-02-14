import { useMemo, useState } from "react"
import AppShell from "../layout/AppShell"
import { transactions } from "../data/transactions"
import dayjs from "dayjs"

export default function Transactions() {
  const [from, setFrom] = useState<string>("")
  const [to, setTo] = useState<string>("")
  const [type, setType] = useState<"All" | "IN" | "OUT">("All")

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const inRange =
        (!from || !dayjs(t.date).isBefore(dayjs(from))) &&
        (!to || !dayjs(t.date).isAfter(dayjs(to)))
      const matchesType = type === "All" || t.type === type
      return inRange && matchesType
    })
  }, [from, to, type])

  return (
    <AppShell>
      <div className="rounded-lg border bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "All" | "IN" | "OUT")}
                className="mt-1 rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option>All</option>
                <option>IN</option>
                <option>OUT</option>
              </select>
            </div>
          </div>
          <div className="text-xs text-gray-600">Showing {filtered.length} transactions</div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <Th>ID</Th>
                <Th>Date</Th>
                <Th>Type</Th>
                <Th>Item</Th>
                <Th className="text-right">Quantity</Th>
                <Th>Unit</Th>
                <Th>Reference</Th>
                <Th>Requested By</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <Td>{t.id}</Td>
                  <Td>{t.date}</Td>
                  <Td>
                    <span
                      className={`inline-flex rounded-md px-2 py-1 text-xs ring-1 ring-inset ${
                        t.type === "IN"
                          ? "bg-green-50 text-green-700 ring-green-600/20"
                          : "bg-red-50 text-red-700 ring-red-600/20"
                      }`}
                    >
                      {t.type}
                    </span>
                  </Td>
                  <Td>{t.itemCode}</Td>
                  <Td className="text-right">{t.quantity.toLocaleString()}</Td>
                  <Td>{t.unit}</Td>
                  <Td>{t.reference}</Td>
                  <Td>{t.requestedBy ?? "—"}</Td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <Td colSpan={8} className="text-center text-sm text-gray-600">
                    No transactions in selected range
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-2 text-left text-xs font-medium text-gray-700 ${className}`}>{children}</th>
}
function Td({
  children,
  className = "",
  colSpan,
}: {
  children: React.ReactNode
  className?: string
  colSpan?: number
}) {
  return <td className={`px-4 py-2 text-sm text-gray-700 ${className}`} colSpan={colSpan}>{children}</td>
}
