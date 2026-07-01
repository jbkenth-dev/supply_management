import { useEffect, useState } from "react"
import {
  CurrencyDollarIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
  PencilIcon,
  CheckCircleIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline"
import AppShell from "../layout/AppShell"
import { ToastContainer, type ToastProps } from "../components/ui/Toast"
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
  updatedAt: string
}

type BudgetResponse = {
  success: boolean
  budgets?: BudgetRecord[]
  totalAnnualBudget?: number
  totalSpent?: number
  message?: string
}

const DEPARTMENTS = [
  "College of Arts and Sciences",
  "College of Business and Accountancy",
  "College of Education",
  "College of Engineering and Technology",
  "College of Nursing and Health Sciences",
  "Senior High School Department",
  "Junior High School Department",
  "Elementary Department",
  "Administration Office",
  "Finance Office",
  "Registrar's Office",
  "Library",
  "Guidance Office",
  "MIS/IT Office",
  "Property and Supply Office",
]

export default function BudgetManagement() {
  const authUser = getStoredAuthUser()
  const [budgets, setBudgets] = useState<BudgetRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState<ToastProps[]>([])
  const [editingDept, setEditingDept] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState("")

  const removeToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))

  const pushToast = (title: string, message: string, type: ToastProps["type"]) => {
    setToasts((prev) => [
      ...prev,
      { id: `budget-${Date.now()}`, title, message, type, onDismiss: removeToast },
    ])
  }

  const loadBudgets = async () => {
    if (!authUser?.id) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ userId: String(authUser.id), role: authUser.role })
      const res = await api(`/api/budget-management.php?${params.toString()}`)
      const result = (await res.json()) as BudgetResponse
      if (result.success) {
        setBudgets(result.budgets ?? [])
      }
    } catch {
      pushToast("Load Failed", "Unable to load budget data.", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadBudgets() }, [authUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSetBudget = async (dept: string) => {
    const amount = parseFloat(editAmount)
    if (isNaN(amount) || amount < 0) {
      pushToast("Invalid Amount", "Please enter a valid budget amount.", "warning")
      return
    }

    try {
      const res = await api("/api/budget-management.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_budget",
          department: dept,
          annualBudget: amount,
        }),
      })
      const result = await res.json()
      if (!res.ok || !result.success) throw new Error(result.message ?? "Failed to update budget.")
      pushToast("Budget Updated", `${dept} annual budget set to ₱${amount.toFixed(2)}.`, "success")
      setEditingDept(null)
      setEditAmount("")
      void loadBudgets()
    } catch (error) {
      pushToast("Error", error instanceof Error ? error.message : "Failed to update budget.", "error")
    }
  }

  const totalAnnual = budgets.reduce((s, b) => s + b.annualBudget, 0)
  const totalSpent = budgets.reduce((s, b) => s + b.totalSpent, 0)
  const totalRemaining = budgets.reduce((s, b) => s + b.remainingBudget, 0)

  return (
    <AppShell role={authUser?.role ?? "Faculty Staff"}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="space-y-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-600">Budget Management</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-brown-900">Department Budgets</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brown-500">
            Manage annual budgets, view spending, and track utilization across departments.
          </p>
        </div>

        {/* Overall Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-brown-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brown-400">Total Annual Budget</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-600">
                <BanknotesIcon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-black tracking-tight text-brown-900">₱{(totalAnnual ?? 0).toLocaleString()}</p>
          </div>
          <div className="rounded-[1.5rem] border border-brown-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brown-400">Total Spent</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-100 bg-amber-50 text-amber-600">
                <ArrowTrendingUpIcon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-black tracking-tight text-amber-700">₱{(totalSpent ?? 0).toLocaleString()}</p>
          </div>
          <div className="rounded-[1.5rem] border border-brown-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brown-400">Total Remaining</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary-100 bg-primary-50 text-primary-600">
                <CurrencyDollarIcon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-black tracking-tight text-primary-700">₱{(totalRemaining ?? 0).toLocaleString()}</p>
          </div>
        </div>

        {/* Budget Table */}
        <section className="rounded-[2rem] border border-brown-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-brown-400">{new Date().getFullYear()} Budget</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-brown-900">Department Allocations</h2>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-brown-200 bg-brown-50 p-5">
                  <div className="h-5 w-48 rounded-full bg-brown-200" />
                  <div className="mt-3 h-4 w-full rounded-full bg-brown-100" />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {budgets.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-brown-200 bg-brown-50 px-6 py-12 text-center">
                  <ChartBarIcon className="mx-auto h-10 w-10 text-brown-300" />
                  <p className="mt-4 text-sm font-semibold text-brown-900">No budgets configured yet</p>
                  <p className="mt-2 text-sm text-brown-500">Set annual budgets for departments to start tracking.</p>
                </div>
              ) : (
                budgets.map((budget) => (
                  <div key={budget.id} className="rounded-[1.5rem] border border-brown-200 bg-brown-50 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <p className="text-base font-black text-brown-900">{budget.department}</p>
                          {budget.utilization > 90 ? (
                            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-rose-700">
                              Critical
                            </span>
                          ) : budget.utilization > 75 ? (
                            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">
                              High
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-4 grid gap-4 sm:grid-cols-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brown-400">Annual Budget</p>
                            <p className="mt-1 text-lg font-black text-brown-900">₱{budget.annualBudget.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brown-400">Total Spent</p>
                            <p className="mt-1 text-lg font-black text-amber-700">₱{budget.totalSpent.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brown-400">Remaining</p>
                            <p className={`mt-1 text-lg font-black ${budget.remainingBudget > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                              ₱{budget.remainingBudget.toLocaleString()}
                            </p>
                          </div>
                        </div>

                        {/* Utilization Bar */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold uppercase tracking-[0.18em] text-brown-400">Utilization</span>
                            <span className="font-black text-brown-700">{budget.utilization}%</span>
                          </div>
                          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-brown-200">
                            <div
                              className={`h-full rounded-full transition-all ${
                                budget.utilization > 90 ? "bg-rose-500" : budget.utilization > 75 ? "bg-amber-500" : "bg-emerald-500"
                              }`}
                              style={{ width: `${Math.min(budget.utilization, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {authUser?.role === "Administrator" ? (
                        editingDept === budget.department ? (
                          <div className="flex flex-col gap-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              placeholder="Annual budget"
                              className="rounded-xl border border-brown-200 bg-white px-4 py-2.5 text-sm text-brown-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void handleSetBudget(budget.department)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white hover:bg-primary-700"
                              >
                                <CheckCircleIcon className="h-4 w-4" />
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => { setEditingDept(null); setEditAmount("") }}
                                className="rounded-xl border border-brown-200 bg-white px-4 py-2 text-xs font-bold text-brown-600 hover:bg-brown-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setEditingDept(budget.department); setEditAmount(String(budget.annualBudget)) }}
                            className="rounded-xl border border-brown-200 bg-white px-4 py-2.5 text-sm font-semibold text-brown-600 hover:bg-brown-50"
                          >
                            <PencilIcon className="inline h-4 w-4 mr-1" />
                            Edit Budget
                          </button>
                        )
                      ) : null}
                    </div>
                  </div>
                ))
              )}

              {/* Add Budget for unconfigured departments */}
              {authUser?.role === "Administrator" && (
                <div className="mt-6 border-t border-brown-200 pt-6">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-brown-400">Add New Budget</p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_200px_auto]">
                    <select
                      id="new-dept"
                      value={editingDept ?? ""}
                      onChange={(e) => { setEditingDept(e.target.value); setEditAmount("") }}
                      className="rounded-xl border border-brown-200 bg-white px-4 py-2.5 text-sm text-brown-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    >
                      <option value="">Select department...</option>
                      {DEPARTMENTS.filter((d) => !budgets.some((b) => b.department === d)).map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      placeholder="Annual budget"
                      className="rounded-xl border border-brown-200 bg-white px-4 py-2.5 text-sm text-brown-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => editingDept && void handleSetBudget(editingDept)}
                      disabled={!editingDept || !editAmount}
                      className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Set Budget
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}
