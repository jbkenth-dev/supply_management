import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowDownTrayIcon, ArrowPathIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline"
import AppShell from "../../layout/AppShell"
import { getStoredAuthUser, type AuthRole } from "../../lib/auth"
import type { StockEntry, SupplyItem } from "../../types/adminInventory"

type StockForm = {
  supplyId: string
  quantity: string
}

type FieldErrors = Record<string, string>

const initialStockForm: StockForm = {
  supplyId: "",
  quantity: "",
}

const STOCKS_PER_PAGE = 8
const ENTRIES_PER_PAGE = 5

export default function StockManagementPage({ role }: { role: Extract<AuthRole, "Administrator" | "Property Custodian"> }) {
  const [supplies, setSupplies] = useState<SupplyItem[]>([])
  const [entries, setEntries] = useState<StockEntry[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<StockForm>(initialStockForm)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)
  const [stockPage, setStockPage] = useState(1)
  const [entriesPage, setEntriesPage] = useState(1)

  useEffect(() => {
    void loadStockData()
  }, [])

  useEffect(() => {
    if (!message) {
      return
    }

    const timer = window.setTimeout(() => {
      setMessage("")
      setIsSuccess(false)
    }, 3500)

    return () => window.clearTimeout(timer)
  }, [message])

  async function loadStockData() {
    setLoading(true)

    try {
      const response = await fetch("/api/admin-stock.php")
      const result = await response.json()

      if (!response.ok) {
        setMessage(result.message ?? "Unable to load stock data.")
        setIsSuccess(false)
        return
      }

      setSupplies(result.supplies ?? [])
      setEntries(result.entries ?? [])
    } catch {
      setMessage("Unable to connect to the stock service. Make sure Apache and MySQL are running in XAMPP.")
      setIsSuccess(false)
    } finally {
      setLoading(false)
    }
  }

  const filteredSupplies = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return supplies.filter((supply) => {
      const haystack = [supply.name, supply.itemCode, supply.categoryName, supply.description].join(" ").toLowerCase()
      return haystack.includes(needle)
    })
  }, [supplies, query])

  const filteredEntries = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return entries.filter((entry) => {
      const haystack = [
        entry.supplyName,
        entry.supplyItemCode,
        entry.categoryName,
        entry.referenceNo ?? "",
        entry.remarks ?? "",
        entry.createdByName,
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(needle)
    })
  }, [entries, query])

  const stockTotalPages = Math.max(1, Math.ceil(filteredSupplies.length / STOCKS_PER_PAGE))
  const entriesTotalPages = Math.max(1, Math.ceil(filteredEntries.length / ENTRIES_PER_PAGE))

  const paginatedSupplies = useMemo(() => {
    const startIndex = (stockPage - 1) * STOCKS_PER_PAGE
    return filteredSupplies.slice(startIndex, startIndex + STOCKS_PER_PAGE)
  }, [filteredSupplies, stockPage])

  const paginatedEntries = useMemo(() => {
    const startIndex = (entriesPage - 1) * ENTRIES_PER_PAGE
    return filteredEntries.slice(startIndex, startIndex + ENTRIES_PER_PAGE)
  }, [entriesPage, filteredEntries])

  useEffect(() => {
    setStockPage(1)
    setEntriesPage(1)
  }, [query])

  useEffect(() => {
    if (stockPage > stockTotalPages) {
      setStockPage(stockTotalPages)
    }
  }, [stockPage, stockTotalPages])

  useEffect(() => {
    if (entriesPage > entriesTotalPages) {
      setEntriesPage(entriesTotalPages)
    }
  }, [entriesPage, entriesTotalPages])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setErrors({})
    setMessage("")

    try {
      const authUser = getStoredAuthUser()
      const response = await fetch("/api/admin-stock.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "add_stock",
          supplyId: Number(form.supplyId),
          quantity: form.quantity,
          createdByUserId: authUser?.id ?? null,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setErrors(result.errors ?? {})
        setMessage(result.message ?? "Unable to save stock.")
        setIsSuccess(false)
        return
      }

      setSupplies(result.supplies ?? [])
      setEntries(result.entries ?? [])
      setForm(initialStockForm)
      setMessage(result.message ?? "Stock added successfully.")
      setIsSuccess(true)
    } catch {
      setMessage("Unable to connect to the stock service. Make sure Apache and MySQL are running in XAMPP.")
      setIsSuccess(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell role={role}>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">Admin Stock</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Stock Management</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Search current quantities and add stock-in records.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadStockData()}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <ArrowPathIcon className="mr-2 h-4 w-4" />
            Refresh Data
          </button>
        </div>

        <AnimatePresence mode="wait">
          {message ? (
            <motion.div
              key={message}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                isSuccess ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {message}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="grid gap-8 xl:grid-cols-[380px_minmax(0,1fr)]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Add Stock</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Stock In</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Supply</label>
                <select
                  value={form.supplyId}
                  onChange={(event) => setForm((current) => ({ ...current, supplyId: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Select supply</option>
                  {supplies.map((supply) => (
                    <option key={supply.id} value={supply.id}>
                      {supply.itemCode} - {supply.name}
                    </option>
                  ))}
                </select>
                {errors.supplyId ? <p className="mt-2 text-xs font-semibold text-rose-600">{errors.supplyId}</p> : null}
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Quantity</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.quantity}
                  onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="100"
                />
                {errors.quantity ? <p className="mt-2 text-xs font-semibold text-rose-600">{errors.quantity}</p> : null}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
                {submitting ? "Saving Stock..." : "Add Stock"}
              </button>
            </form>
          </section>

          <section className="space-y-6">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Search</p>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Current Stock</h2>
                </div>
                <div className="relative w-full max-w-sm">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search stock"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <HeaderCell>Supply</HeaderCell>
                      <HeaderCell>Category</HeaderCell>
                      <HeaderCell>Item Code</HeaderCell>
                      <HeaderCell className="text-right">Quantity</HeaderCell>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-10">
                          <div className="space-y-3 animate-pulse">
                            <div className="h-5 rounded bg-slate-100" />
                            <div className="h-5 rounded bg-slate-100" />
                            <div className="h-5 rounded bg-slate-100" />
                          </div>
                        </td>
                      </tr>
                    ) : filteredSupplies.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-500">
                          No stock records matched your search.
                        </td>
                      </tr>
                    ) : (
                      paginatedSupplies.map((supply) => (
                        <tr key={supply.id} className="transition hover:bg-slate-50">
                          <BodyCell>
                            <div className="font-semibold text-slate-900">{supply.name}</div>
                            <div className="text-xs text-slate-500">{supply.description || "No description"}</div>
                          </BodyCell>
                          <BodyCell>{supply.categoryName}</BodyCell>
                          <BodyCell className="font-semibold text-slate-800">{supply.itemCode}</BodyCell>
                          <BodyCell className="text-right font-semibold text-slate-900">
                            {supply.quantityOnHand.toLocaleString()}
                          </BodyCell>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {!loading && filteredSupplies.length > 0 ? (
                <PaginationBar
                  currentPage={stockPage}
                  totalPages={stockTotalPages}
                  totalItems={filteredSupplies.length}
                  itemsPerPage={STOCKS_PER_PAGE}
                  onPrevious={() => setStockPage((current) => Math.max(1, current - 1))}
                  onNext={() => setStockPage((current) => Math.min(stockTotalPages, current + 1))}
                />
              ) : null}
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">History</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Recent Stock Entries</h2>
              </div>

              <div className="mt-6 space-y-3">
                {loading ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-20 rounded-2xl bg-slate-100" />
                    <div className="h-20 rounded-2xl bg-slate-100" />
                    <div className="h-20 rounded-2xl bg-slate-100" />
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                    No stock entries yet.
                  </div>
                ) : (
                  paginatedEntries.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{entry.supplyName}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {entry.supplyItemCode} • {entry.categoryName} • Added by {entry.createdByName}
                          </p>
                          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                            {formatDateTime(entry.createdAt)}
                          </p>
                        </div>
                        <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
                          +{entry.quantity.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {!loading && filteredEntries.length > 0 ? (
                <PaginationBar
                  currentPage={entriesPage}
                  totalPages={entriesTotalPages}
                  totalItems={filteredEntries.length}
                  itemsPerPage={ENTRIES_PER_PAGE}
                  onPrevious={() => setEntriesPage((current) => Math.max(1, current - 1))}
                  onNext={() => setEntriesPage((current) => Math.min(entriesTotalPages, current + 1))}
                />
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  )
}

function HeaderCell({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <th className={`px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500 ${className}`}>
      {children}
    </th>
  )
}

function BodyCell({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return <td className={`px-6 py-4 text-sm text-slate-600 ${className}`}>{children}</td>
}

function formatDateTime(value: string) {
  const date = new Date(value.replace(" ", "T"))

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

function PaginationBar({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPrevious,
  onNext,
}: {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  onPrevious: () => void
  onNext: () => void
}) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500">
        Showing {startItem} to {endItem} of {totalItems} results
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={currentPage === 1}
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Previous
        </button>
        <span className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={currentPage === totalPages}
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Next
        </button>
      </div>
    </div>
  )
}
