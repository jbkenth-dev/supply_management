import { useEffect, useState } from "react"
import {
  CurrencyDollarIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
  PencilIcon,
  CheckCircleIcon,
  ChartBarIcon,
  XCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import AppShell from "../layout/AppShell"
import { api } from "../lib/api"
import { currentManilaYear } from "../lib/date"
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

type Department = {
  id: number
  name: string
}

type DepartmentResponse = {
  success: boolean
  departments?: Department[]
  message?: string
}

export default function BudgetManagement() {
  const authUser = getStoredAuthUser()
  const [budgets, setBudgets] = useState<BudgetRecord[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [editingDept, setEditingDept] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState("")
  const [newDept, setNewDept] = useState("")
  const [newAmount, setNewAmount] = useState("")
  const [resultModal, setResultModal] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null)

  const loadBudgets = async () => {
    if (!authUser?.id) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ userId: String(authUser.id), role: authUser.role })
      const [budgetResponse, departmentResponse] = await Promise.all([
        api(`/api/budget-management.php?${params.toString()}`),
        api("/api/admin-departments.php"),
      ])
      const budgetResult = (await budgetResponse.json()) as BudgetResponse
      const departmentResult = (await departmentResponse.json()) as DepartmentResponse

      if (!budgetResponse.ok || !budgetResult.success) {
        throw new Error(budgetResult.message ?? "Unable to load budget data.")
      }

      if (!departmentResponse.ok || !departmentResult.success) {
        throw new Error(departmentResult.message ?? "Unable to load departments.")
      }

      setBudgets(budgetResult.budgets ?? [])
      setDepartments(departmentResult.departments ?? [])
    } catch {
      setResultModal({ type: "error", title: "Load Failed", message: "Unable to load budget data." })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadBudgets() }, [authUser?.id])

  const handleSetBudget = async (dept: string, amount?: number) => {
    const finalAmount = amount ?? parseFloat(editAmount)
    const validationError = validateAnnualBudget(finalAmount)
    if (validationError) {
      setResultModal({ type: "error", title: "Invalid Amount", message: validationError })
      return
    }

    if (!departments.some((department) => department.name === dept)) {
      setResultModal({ type: "error", title: "Invalid Department", message: "Please select a valid department." })
      return
    }

    try {
      const res = await api("/api/budget-management.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_budget",
          department: dept,
          annualBudget: finalAmount,
        }),
      })
      const result = await res.json()
      if (!res.ok || !result.success) throw new Error(result.message ?? "Failed to update budget.")
      setResultModal({ type: "success", title: "Budget Updated", message: `${dept} annual budget set to ₱${finalAmount.toFixed(2)}.` })
      setEditingDept(null)
      setEditAmount("")
      void loadBudgets()
    } catch (error) {
      setResultModal({ type: "error", title: "Error", message: error instanceof Error ? error.message : "Failed to update budget." })
    }
  }

  const totalAnnual = budgets.reduce((s, b) => s + b.annualBudget, 0)
  const totalSpent = budgets.reduce((s, b) => s + b.totalSpent, 0)
  const totalRemaining = budgets.reduce((s, b) => s + b.remainingBudget, 0)
  const availableDepartments = departments.filter((department) => !budgets.some((budget) => budget.department === department.name))

  return (
    <AppShell role={authUser?.role ?? "Faculty Staff"}>
      {resultModal ? (
        <ResultModal
          type={resultModal.type}
          title={resultModal.title}
          message={resultModal.message}
          onClose={() => setResultModal(null)}
        />
      ) : null}
      <div className="space-y-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-600">Budget Management</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-brown-900">Department Budgets</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brown-500">
            Manage annual budgets, view spending, and track utilization across departments.
          </p>
        </div>

        {authUser?.role === "Administrator" && (
            <div className="mt-6 border-t border-brown-200 pt-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brown-400">Add New Budget</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_200px_auto]">
                <select
                  id="new-dept"
                  value={newDept}
                  onChange={(e) => { setNewDept(e.target.value); setNewAmount("") }}
                  className="rounded-xl border border-brown-200 bg-white px-4 py-2.5 text-sm text-brown-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="">Select department...</option>
                  {availableDepartments.map((department) => (
                    <option key={department.id} value={department.name}>{department.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="100"
                  max="100000000"
                  step="0.01"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="Annual budget"
                  className="rounded-xl border border-brown-200 bg-white px-4 py-2.5 text-sm text-brown-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newDept || !newAmount) {
                      setResultModal({ type: "error", title: "Invalid Amount", message: "Annual budget is required." })
                      return
                    }

                    const finalAmount = parseFloat(newAmount)
                    const validationError = validateAnnualBudget(finalAmount)
                    if (validationError) {
                      setResultModal({ type: "error", title: "Invalid Amount", message: validationError })
                      return
                    }

                    void handleSetBudget(newDept, finalAmount)
                    setNewDept("")
                    setNewAmount("")
                  }}
                  disabled={!newDept || !newAmount}
                  className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Set Budget
                </button>
              </div>
            </div>
          )}


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
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-brown-400">{currentManilaYear()} Budget</p>
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
                              min="100"
                              max="100000000"
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
            </div>
          )}

          {/* Add Budget for unconfigured departments - always visible for admins */}
                  </section>
      </div>
    </AppShell>
  )
}

function validateAnnualBudget(value: number): string {
  if (Number.isNaN(value)) {
    return "Annual budget is required."
  }

  if (value < 100) {
    return "Annual budget must be at least 100."
  }

  if (value > 100000000) {
    return "Annual budget cannot exceed 100000000."
  }

  return ""
}

function ResultModal({ type, title, message, onClose }: { type: "success" | "error"; title: string; message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-950/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-[2rem] border border-brown-200 bg-white p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl ${
            type === "success" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
          }`}>
            {type === "success" ? (
              <CheckCircleIcon className="h-7 w-7" />
            ) : (
              <XCircleIcon className="h-7 w-7" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${
                  type === "success" ? "text-emerald-600" : "text-rose-600"
                }`}>
                  {type === "success" ? "Success" : "Error"}
                </p>
                <h3 className="mt-1.5 text-xl font-black tracking-tight text-brown-900">{title}</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-brown-200 bg-white text-brown-400 hover:border-brown-300 hover:text-brown-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-brown-500">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl px-6 py-3 text-sm font-bold text-white transition ${
              type === "success" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
            }`}
          >
            {type === "success" ? "Done" : "Close"}
          </button>
        </div>
      </div>
    </div>
  )
}
