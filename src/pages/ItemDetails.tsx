import { useParams, Link, useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"
import {
  ChevronLeftIcon,
  ExclamationTriangleIcon,
  MinusIcon,
  PlusIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline"
import { SkeletonItemDetails } from "../components/ui/Skeleton"
import { FadeIn, StaggerContainer, StaggerItem } from "../components/ui/animations"
import type { SupplyItem } from "../types/adminInventory"

export default function ItemDetails() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [requestQty, setRequestQty] = useState(1)
  const [item, setItem] = useState<SupplyItem | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadItem = async () => {
      setLoading(true)

      try {
        const response = await fetch(`/api/public-supplies.php?itemCode=${encodeURIComponent(code ?? "")}`)
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.message ?? "Unable to load supply details.")
        }

        if (!cancelled) {
          setItem(result.supply ?? null)
        }
      } catch {
        if (!cancelled) {
          setItem(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadItem()

    return () => {
      cancelled = true
    }
  }, [code])

  if (loading) return <SkeletonItemDetails />

  if (!item) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center p-4 pt-24">
        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-12 text-center max-w-md w-full shadow-2xl shadow-slate-200/50">
          <div className="inline-flex items-center justify-center p-4 bg-rose-50 rounded-full mb-6">
            <ExclamationTriangleIcon className="h-12 w-12 text-rose-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Item Not Found</h2>
          <p className="text-slate-500 mb-8">The supply item you're looking for doesn't exist or has been removed from the inventory.</p>
          <Link
            to="/supplies"
            className="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-primary-600 transition-all active:scale-95"
          >
            <ChevronLeftIcon className="h-5 w-5" />
            Back to Supplies
          </Link>
        </div>
      </div>
    )
  }

  const getStatusColor = (quantity: number) => {
    if (quantity > 20) return "text-emerald-500 bg-emerald-50 border-emerald-100"
    if (quantity > 10) return "text-amber-500 bg-amber-50 border-amber-100"
    return "text-rose-500 bg-rose-50 border-rose-100"
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pt-24 pb-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="mb-8 flex items-center gap-4">
            <Link
              to="/supplies"
              className="flex items-center justify-center w-12 h-12 bg-white rounded-2xl border border-slate-200 text-slate-400 hover:text-primary-600 hover:border-primary-200 transition-all"
            >
              <ChevronLeftIcon className="h-6 w-6" />
            </Link>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">SUPPLY</p>
              <p className="text-sm font-bold text-slate-900">Item Details</p>
            </div>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-6">
            <StaggerContainer>
              <StaggerItem>
                <div className="relative aspect-square rounded-[2.5rem] overflow-hidden bg-white border border-slate-200 shadow-xl shadow-slate-200/50 group">
                  <img
                    src={item.imagePath || "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=800&fit=crop"}
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                  <div className="absolute bottom-8 left-8 right-8">
                    <span className="px-4 py-2 bg-white/20 backdrop-blur-md border border-white/30 rounded-full text-white text-xs font-black uppercase tracking-widest">
                      {item.categoryName}
                    </span>
                  </div>
                </div>
              </StaggerItem>

              <StaggerItem>
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Current Stock</p>
                    <p className="text-3xl font-black text-slate-900">{item.quantityOnHand}</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black border ${getStatusColor(item.quantityOnHand)}`}>
                      {item.quantityOnHand > 20 ? "IN STOCK" : item.quantityOnHand > 10 ? "LOW STOCK" : "CRITICAL"}
                    </div>
                  </div>
                </div>
              </StaggerItem>
            </StaggerContainer>
          </div>

          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-4">
              <FadeIn delay={0.1}>
                <p className="text-sm font-black text-primary-600 uppercase tracking-[0.2em]">Item Code: {item.itemCode}</p>
                <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">{item.name}</h1>
                <p className="text-lg text-slate-500 leading-relaxed max-w-2xl">
                  {item.description || "High-quality supply item maintained with precision tracking and automated inventory management."}
                </p>
              </FadeIn>
            </div>

            <FadeIn delay={0.2}>
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50/50 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary-100/50 transition-colors" />

                <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-8">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight mb-1">Request Supply</h3>
                      <p className="text-sm font-medium text-slate-500">Select the quantity you need to request.</p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="inline-flex items-center p-1.5 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                        <button
                          onClick={() => setRequestQty(Math.max(1, requestQty - 1))}
                          className="w-12 h-12 flex items-center justify-center bg-white rounded-xl border border-slate-200 text-slate-400 hover:text-primary-600 hover:border-primary-200 hover:shadow-sm active:scale-95 transition-all"
                        >
                          <MinusIcon className="w-5 h-5" />
                        </button>

                        <div className="w-16 text-center">
                          <span className="text-xl font-black text-slate-900">{requestQty}</span>
                        </div>

                        <button
                          onClick={() => setRequestQty(Math.min(item.quantityOnHand, requestQty + 1))}
                          className="w-12 h-12 flex items-center justify-center bg-white rounded-xl border border-slate-200 text-slate-400 hover:text-primary-600 hover:border-primary-200 hover:shadow-sm active:scale-95 transition-all"
                        >
                          <PlusIcon className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="hidden sm:block">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Request</p>
                        <p className="text-sm font-bold text-slate-900">{requestQty} item{requestQty > 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/new-request?itemCode=${encodeURIComponent(item.itemCode)}`)}
                    disabled={item.quantityOnHand === 0}
                    className="flex-shrink-0 inline-flex items-center justify-center gap-3 px-10 py-5 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 disabled:bg-slate-200 disabled:cursor-not-allowed shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 active:scale-[0.98] transition-all"
                  >
                    <PaperAirplaneIcon className="w-5 h-5" />
                    Submit Request
                  </button>
                </div>

                {item.quantityOnHand === 0 && (
                  <div className="mt-4 flex items-center gap-2 text-rose-500">
                    <ExclamationTriangleIcon className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Out of stock - Requests are currently disabled</span>
                  </div>
                )}
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </div>
  )
}
