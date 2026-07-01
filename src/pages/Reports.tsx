import dayjs from "dayjs"
import { useEffect, useMemo, useState } from "react"
import {
  BanknotesIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/outline"
import AppShell from "../layout/AppShell"
import { api } from "../lib/api"
import { getStoredAuthUser } from "../lib/auth"

type BudgetRecord = {
  id: number
  department: string
  fiscalYear: number
  annualBudget: number
  totalSpent: number
  remainingBudget: number
  utilization: number
}

type RequestRecord = {
  id: number
  requestNumber: string
  department: string
  status: string
  grandTotal: number
  totalItems: number
  createdAt: string
  requestedByName: string
}

export default function Reports() {
  const authUser = getStoredAuthUser()
  const [budgets, setBudgets] = useState<BudgetRecord[]>([])
  const [requests, setRequests] = useState<RequestRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"budget" | "requests">("budget")

  useEffect(() => {
    if (!authUser?.id) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const now = new Date().getFullYear()
        const [budgetRes, requestRes] = await Promise.all([
          api(`/api/budget-management.php?userId=${authUser.id}&role=${authUser.role}&fiscalYear=${now}`),
          api(`/api/admin-request-issuance.php?userId=${authUser.id}&role=${authUser.role}`),
        ])

        const budgetResult = await budgetRes.json()
        const requestResult = await requestRes.json()

        if (!cancelled) {
          if (budgetResult.success) setBudgets(budgetResult.budgets ?? [])
          if (requestResult.success) setRequests(requestResult.requests ?? [])
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [authUser?.id])

  const requestStats = useMemo(() => {
    const total = requests.length
    const pending = requests.filter((r) => r.status.includes("Pending")).length
    const approved = requests.filter((r) => r.status === "Approved" || r.status === "Completed").length
    const rejected = requests.filter((r) => r.status === "Rejected" || r.status === "Cancelled").length
    return { total, pending, approved, rejected }
  }, [requests])

  const budgetStats = useMemo(() => {
    const totalBudget = budgets.reduce((s, b) => s + b.annualBudget, 0)
    const totalSpent = budgets.reduce((s, b) => s + b.totalSpent, 0)
    const totalRemaining = budgets.reduce((s, b) => s + b.remainingBudget, 0)
    const overallUtil = totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(2) : "0.00"
    return { totalBudget, totalSpent, totalRemaining, overallUtil }
  }, [budgets])

  return (
    <AppShell role={authUser?.role ?? "Faculty Staff"}>
      <div className="space-y-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-600">Reports</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-brown-900">Reports & Analytics</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brown-500">
            View budget utilization and request statistics.
          </p>
        </div>

        <div className="flex gap-2 rounded-xl bg-brown-100 p-1 w-fit">
          <button onClick={() => setActiveTab("budget")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all ${activeTab === "budget" ? "bg-white text-primary-600 shadow-sm" : "text-brown-500 hover:text-brown-700"}`}>
            <BanknotesIcon className="h-4 w-4" /> Budget Reports
          </button>
          <button onClick={() => setActiveTab("requests")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all ${activeTab === "requests" ? "bg-white text-primary-600 shadow-sm" : "text-brown-500 hover:text-brown-700"}`}>
            <ClipboardDocumentCheckIcon className="h-4 w-4" /> Request Reports
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-[1.5rem] border border-brown-200 bg-brown-50 p-5">
                <div className="h-4 w-32 rounded-full bg-brown-200" />
                <div className="mt-3 h-8 w-48 rounded-2xl bg-brown-200" />
              </div>
            ))}
          </div>
        ) : activeTab === "budget" ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <SummaryCard label="Total Annual Budget" value={`₱${budgetStats.totalBudget.toLocaleString()}`} />
              <SummaryCard label="Total Spent" value={`₱${budgetStats.totalSpent.toLocaleString()}`} tone="amber" />
              <SummaryCard label="Remaining" value={`₱${budgetStats.totalRemaining.toLocaleString()}`} tone="emerald" />
              <SummaryCard label="Utilization" value={`${budgetStats.overallUtil}%`} tone="primary" />
            </div>
            <section className="rounded-[2rem] border border-brown-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-brown-400">Department Budget Summary</p>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brown-200 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-brown-400">
                      <th className="pb-3 pr-4">Department</th>
                      <th className="pb-3 pr-4">Annual Budget</th>
                      <th className="pb-3 pr-4">Spent</th>
                      <th className="pb-3 pr-4">Remaining</th>
                      <th className="pb-3 pr-4">Utilization</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgets.map((b) => (
                      <tr key={b.id} className="border-b border-brown-100">
                        <td className="py-3 pr-4 font-semibold text-brown-900">{b.department}</td>
                        <td className="py-3 pr-4">₱{b.annualBudget.toLocaleString()}</td>
                        <td className="py-3 pr-4 text-amber-700">₱{b.totalSpent.toLocaleString()}</td>
                        <td className={`py-3 pr-4 font-semibold ${b.remainingBudget > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          ₱{b.remainingBudget.toLocaleString()}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-20 overflow-hidden rounded-full bg-brown-200">
                              <div className={`h-full rounded-full ${b.utilization > 90 ? "bg-rose-500" : b.utilization > 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                                style={{ width: `${Math.min(b.utilization, 100)}%` }} />
                            </div>
                            <span className="text-xs font-bold">{b.utilization}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {budgets.length === 0 ? <tr><td colSpan={5} className="py-8 text-center text-brown-400">No budget data.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <SummaryCard label="Total Requests" value={String(requestStats.total)} />
              <SummaryCard label="Pending" value={String(requestStats.pending)} tone="amber" />
              <SummaryCard label="Approved/Completed" value={String(requestStats.approved)} tone="emerald" />
              <SummaryCard label="Rejected" value={String(requestStats.rejected)} tone="rose" />
            </div>
            <section className="rounded-[2rem] border border-brown-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-brown-400">Request Summary</p>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brown-200 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-brown-400">
                      <th className="pb-3 pr-4">Request #</th>
                      <th className="pb-3 pr-4">Requester</th>
                      <th className="pb-3 pr-4">Dept</th>
                      <th className="pb-3 pr-4">Items</th>
                      <th className="pb-3 pr-4">Total</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3 pr-4">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.slice(0, 50).map((r) => (
                      <tr key={r.id} className="border-b border-brown-100">
                        <td className="py-3 pr-4 font-semibold text-brown-900">{r.requestNumber}</td>
                        <td className="py-3 pr-4">{r.requestedByName}</td>
                        <td className="py-3 pr-4">{r.department}</td>
                        <td className="py-3 pr-4">{r.totalItems}</td>
                        <td className="py-3 pr-4 font-semibold text-primary-700">₱{(r.grandTotal ?? 0).toFixed(2)}</td>
                        <td className="py-3 pr-4">
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
                            r.status.includes("Pending") ? "bg-amber-100 text-amber-700" :
                            ["Approved","Completed","Received"].includes(r.status) ? "bg-emerald-100 text-emerald-700" :
                            ["Rejected","Cancelled"].includes(r.status) ? "bg-rose-100 text-rose-700" :
                            "bg-blue-100 text-blue-700"
                          }`}>{r.status}</span>
                        </td>
                        <td className="py-3 pr-4 text-xs text-brown-400">{dayjs(r.createdAt).format("MMM D, YYYY")}</td>
                      </tr>
                    ))}
                    {requests.length === 0 ? <tr><td colSpan={7} className="py-8 text-center text-brown-400">No request data.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  )
}

function SummaryCard({ label, value, tone = "slate" }: { label: string; value: string; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "text-brown-900",
    amber: "text-amber-700",
    emerald: "text-emerald-700",
    rose: "text-rose-700",
    primary: "text-primary-700",
  }
  return (
    <div className="rounded-[1.5rem] border border-brown-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brown-400">{label}</p>
      <p className={`mt-3 text-3xl font-black tracking-tight ${tones[tone] ?? tones.slate}`}>{value}</p>
    </div>
  )
}
