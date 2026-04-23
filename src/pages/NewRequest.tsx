import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  MagnifyingGlassIcon,
  MinusIcon,
  PlusIcon,
  PaperAirplaneIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline"
import AppShell from "../layout/AppShell"
import { ToastContainer, type ToastProps } from "../components/ui/Toast"
import { getStoredAuthUser } from "../lib/auth"
import type { SupplyItem } from "../types/adminInventory"

type CatalogResponse = {
  success: boolean
  supplies: SupplyItem[]
  message?: string
}

export default function NewRequest() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState("")
  const [notes, setNotes] = useState("")
  const [supplies, setSupplies] = useState<SupplyItem[]>([])
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toasts, setToasts] = useState<ToastProps[]>([])
  const authUser = getStoredAuthUser()
  const preselectedItemCode = searchParams.get("itemCode")?.trim().toUpperCase() ?? ""

  const removeToast = (id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }

  const pushToast = (toast: Omit<ToastProps, "onDismiss">) => {
    setToasts((current) => [...current, { ...toast, onDismiss: removeToast }])
  }

  useEffect(() => {
    let cancelled = false

    const loadSupplies = async () => {
      setLoading(true)

      try {
        const response = await fetch("/api/public-supplies.php")
        const result = (await response.json()) as CatalogResponse

        if (!response.ok || !result.success) {
          throw new Error(result.message ?? "Unable to load supply catalog.")
        }

        if (!cancelled) {
          setSupplies(result.supplies ?? [])
        }
      } catch (error) {
        if (!cancelled) {
          setSupplies([])
          pushToast({
            id: `catalog-error-${Date.now()}`,
            title: "Catalog Load Failed",
            message: error instanceof Error ? error.message : "Unable to load supply catalog.",
            type: "error",
          })
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSupplies()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!preselectedItemCode || supplies.length === 0) {
      return
    }

    const preselectedSupply = supplies.find((supply) => supply.itemCode.toUpperCase() === preselectedItemCode)

    if (!preselectedSupply || preselectedSupply.quantityOnHand < 1) {
      return
    }

    setQuantities((current) => {
      if (current[preselectedSupply.id]) {
        return current
      }

      return {
        ...current,
        [preselectedSupply.id]: 1,
      }
    })
  }, [preselectedItemCode, supplies])

  const filteredSupplies = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) {
      return supplies
    }

    return supplies.filter((supply) =>
      [supply.name, supply.itemCode, supply.categoryName, supply.description].some((value) =>
        value.toLowerCase().includes(query)
      )
    )
  }, [search, supplies])

  const selectedItems = useMemo(() => {
    return supplies
      .filter((supply) => (quantities[supply.id] ?? 0) > 0)
      .map((supply) => ({
        ...supply,
        requestedQuantity: quantities[supply.id],
      }))
  }, [quantities, supplies])

  const totalUnits = selectedItems.reduce((sum, item) => sum + item.requestedQuantity, 0)

  const setQuantity = (supply: SupplyItem, quantity: number) => {
    const nextQuantity = Math.max(0, Math.min(quantity, supply.quantityOnHand))

    setQuantities((current) => {
      if (nextQuantity === 0) {
        const { [supply.id]: _removed, ...rest } = current
        return rest
      }

      return {
        ...current,
        [supply.id]: nextQuantity,
      }
    })
  }

  const handleSubmit = async () => {
    if (!authUser?.id || authUser.role !== "Faculty Staff") {
      pushToast({
        id: `auth-error-${Date.now()}`,
        title: "Faculty Login Required",
        message: "Sign in with a faculty account before submitting a request.",
        type: "error",
      })
      return
    }

    if (selectedItems.length === 0) {
      pushToast({
        id: `empty-request-${Date.now()}`,
        title: "No Supplies Selected",
        message: "Add at least one supply item to your request.",
        type: "warning",
      })
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch("/api/faculty-requests.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: authUser.id,
          role: authUser.role,
          notes,
          items: selectedItems.map((item) => ({
            supplyId: item.id,
            quantity: item.requestedQuantity,
          })),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message ?? "Unable to submit your supply request.")
      }

      setQuantities({})
      setNotes("")
      pushToast({
        id: `request-created-${Date.now()}`,
        title: "Request Submitted",
        message: result.message ?? "Your supply request has been submitted.",
        type: "success",
      })
      navigate("/my-requests")
    } catch (error) {
      pushToast({
        id: `request-error-${Date.now()}`,
        title: "Submission Failed",
        message: error instanceof Error ? error.message : "Unable to submit your supply request.",
        type: "error",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell role="Faculty Staff">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="space-y-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-600">Faculty Request</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">New Supply Request</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Browse live inventory from the database, request multiple supplies in one submission, and send a clean request to the supply team.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Selection</p>
            <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{selectedItems.length}</p>
            <p className="text-sm text-slate-500">{totalUnits} total quantity{totalUnits === 1 ? "" : "s"}</p>
          </div>
        </div>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Catalog</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Available Supplies</h2>
              </div>
              <label className="relative block w-full sm:max-w-md">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, code, or category"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </label>
            </div>

            <div className="mt-6">
              {loading ? (
                <div className="grid gap-5 lg:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="animate-pulse rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                      <div className="aspect-[4/3] rounded-[1.25rem] bg-slate-200" />
                      <div className="mt-4 h-4 w-24 rounded-full bg-slate-200" />
                      <div className="mt-3 h-7 w-40 rounded-2xl bg-slate-200" />
                      <div className="mt-4 h-4 w-full rounded-full bg-slate-100" />
                      <div className="mt-2 h-4 w-4/5 rounded-full bg-slate-100" />
                    </div>
                  ))}
                </div>
              ) : filteredSupplies.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                  <ClipboardDocumentListIcon className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-4 text-sm font-semibold text-slate-900">No supplies found</p>
                  <p className="mt-2 text-sm text-slate-500">Try another search term to find the item you need.</p>
                </div>
              ) : (
                <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-2">
                  {filteredSupplies.map((supply) => {
                    const quantity = quantities[supply.id] ?? 0
                    const outOfStock = supply.quantityOnHand < 1

                    return (
                      <article
                        key={supply.id}
                        className={`group mx-auto flex h-full w-full max-w-[460px] flex-col overflow-hidden rounded-[1.75rem] border bg-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl ${
                          quantity > 0 ? "border-primary-300 shadow-lg shadow-primary-100/50" : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="relative aspect-[4/3] overflow-hidden border-b border-slate-200 bg-slate-100">
                          <img
                            src={supply.imagePath || "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=320&h=320&fit=crop"}
                            alt={supply.name}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent px-4 py-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-slate-700 bg-slate-950/85 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur-sm">
                                {supply.categoryName}
                              </span>
                              <span className="rounded-full border border-slate-900 bg-slate-950 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur-sm">
                                {supply.itemCode}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-1 flex-col p-4">
                          <div className="flex min-h-[20px] items-center">
                            {preselectedItemCode === supply.itemCode.toUpperCase() ? (
                              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-semibold text-blue-700">
                                Preselected
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-2 min-h-[24px]">
                            <h3 className="line-clamp-2 text-[12px] font-black uppercase tracking-[0.08em] text-slate-900">{supply.name}</h3>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <div className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Stock</p>
                              <p className="mt-1 text-[12px] font-black tracking-tight text-slate-900">{supply.quantityOnHand}</p>
                            </div>
                            <div className="min-w-0 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Quantity</p>
                              <div className="mt-3 grid grid-cols-[44px_56px_44px] justify-center items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setQuantity(supply, quantity - 1)}
                                  disabled={quantity === 0}
                                  className="flex h-10 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-primary-200 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <MinusIcon className="h-4 w-4" />
                                </button>
                                <div className="flex h-10 w-14 items-center justify-center rounded-xl border border-slate-200 bg-white text-center">
                                  <p className="text-[12px] font-black tracking-tight text-slate-900">{quantity}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setQuantity(supply, quantity + 1)}
                                  disabled={outOfStock || quantity >= supply.quantityOnHand}
                                  className="flex h-10 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-primary-200 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <PlusIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Request Summary</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Submission Cart</h2>

              <div className="mt-6 space-y-4">
                {selectedItems.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                    <ExclamationTriangleIcon className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-semibold text-slate-900">No supplies selected yet</p>
                    <p className="mt-2 text-sm text-slate-500">Choose one or more items from the catalog to build your request.</p>
                  </div>
                ) : (
                  selectedItems.map((item) => (
                    <div key={item.id} className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
                          <img
                            src={item.imagePath || "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=200&fit=crop"}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-slate-900">{item.name}</p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.itemCode}</p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-900">
                          x{item.requestedQuantity}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Notes</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={5}
                  placeholder="Add purpose, class/office usage, or any note for the supply team."
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || selectedItems.length === 0}
                className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
                {submitting ? "Submitting Request..." : "Submit Request"}
              </button>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}
