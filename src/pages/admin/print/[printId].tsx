import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../../../lib/api'
import { formatDateLong } from '../../../lib/date'
import { getStoredAuthUser } from '../../../lib/auth'

type RequestItem = {
  requestItemId: number
  supplyId: number | null
  itemCode: string
  name: string
  categoryName: string
  description: string
  imagePath: string
  quantityRequested: number
  quantityApproved: number | null
  quantityFulfilled: number
  quantityOnHand: number
  unitCost: number
  totalAmount: number
}

type AdminRequestRecord = {
  id: number
  requestNumber: string
  issuanceSlipNo: string | null
  requestedByName: string
  requestedByIdNumber: string
  requestedByEmail: string
  requestedByProfileImageUrl: string | null
  purpose: string
  department: string
  dateNeeded: string | null
  grandTotal: number
  reviewedByName: string
  reviewedByRole: string
  rejectionReason?: string
  fulfilledByName: string
  status: string
  notes: string
  reviewNotes: string
  totalItems: number
  totalQuantity: number
  createdAt: string
  updatedAt: string
  reviewedAt: string | null
  fulfilledAt: string | null
  items: RequestItem[]
}

const PrintIssuanceSlipPage = () => {
  const { printId } = useParams<{ printId: string }>()
  const navigate = useNavigate()
  const authUser = getStoredAuthUser()
  const [request, setRequest] = useState<AdminRequestRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const printedRef = useRef(false)

  useEffect(() => {
    if (!printId) {
      setError('Invalid print ID')
      setLoading(false)
      return
    }

    if (!authUser?.id) {
      setError('Authentication required')
      setLoading(false)
      return
    }

    const fetchRequest = async () => {
      try {
        setLoading(true)
        setError(null)

        // Determine if printId is a request ID format or issuance slip number
        let params = new URLSearchParams({
          userId: String(authUser.id),
          role: authUser.role,
        })

        if (printId.startsWith('request-')) {
          // Extract numeric ID from "request-16" -> 16
          const requestId = printId.substring(8) // Remove "request-" prefix
          if (!/^\d+$/.test(requestId)) {
            throw new Error('Invalid request ID format')
          }
          params.append('requestId', requestId)
        } else {
          // Treat as issuance slip number
          params.append('issuanceSlipNo', printId)
        }

        const response = await api(`/api/admin-request-issuance.php?${params.toString()}`, {
          headers: {
            'Accept': 'application/json'
          }
        })
        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.message ?? 'Unable to load request data')
        }

        // Assuming the API returns an array of requests, we take the first one
        const requests = result.requests ?? []
        if (requests.length === 0) {
          throw new Error('Request not found')
        }

        setRequest(requests[0])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchRequest()
  }, [printId, authUser])

  // Reset printed ref when printId changes
  useEffect(() => {
    printedRef.current = false
  }, [printId])

  // Trigger print when the page loads
  useEffect(() => {
    if (!loading && !error && request) {
      // Prevent multiple prints
      if (printedRef.current) {
        return
      }
      printedRef.current = true
      // Trigger print after a small delay to ensure rendering is complete
      const printTimer = setTimeout(() => {
        window.print()
      }, 1000)

      return () => clearTimeout(printTimer)
    }
  }, [loading, error, request])

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="animate-pulse rounded-[1.75rem] bg-brown-100 h-36 w-36"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[200px] flex flex-col items-center justify-center p-6 text-center">
        <p className="text-brown-500">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-700"
        >
          Go Back
        </button>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="min-h-[200px] flex flex-col items-center justify-center p-6 text-center">
        <p className="text-brown-500">No request data found</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-700"
        >
          Go Back
        </button>
      </div>
    )
  }

  // Escape HTML helper
  const escapeHtml = (text: string) => {
    const map: Record<string, string> = {
      '&': '&',
      '<': '&',
      '>': '&',
      '"': '&',
      "'": '&#039;'
    }
    return String(text).replace(/[&<>"']/g, m => map[m])
  }

  return (
    <>
      {/* Print-specific styles */}
      <style>{`
        @media print {
          /* Hide any elements that shouldn't appear in print */
          .no-print {
            display: none !important;
          }

          /* Ensure page breaks correctly */
          @page {
            size: A4;
            margin: 0;
          }

          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }

        /* Screen styles */
        .no-print {
          display: none;
        }
      `}</style>

      {/* Main content */}
      <div className="relative w-full max-w-[210mm] max-h-[calc(100vh_-_3rem)] overflow-y-auto rounded-[1.75rem] border border-brown-200 bg-white shadow-sm">
        {/* Header */}
        <div className="border-b border-brown-200 bg-gradient-to-b from-brown-50 to-white px-6 pb-5 pt-6 text-center sm:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary-600">
            Saint Francis College, Guihulngan, Negros Oriental, Incorporated
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-brown-500">
            Bateria, Poblacion, Guihulngan City, Negros Oriental
          </p>
          <h1 className="mt-2 text-lg font-black uppercase tracking-wide text-brown-900 sm:text-xl">
            OFFICE OF THE VICE PRESIDENT FOR FINANCE
          </h1>
          <div className="mx-auto my-4 h-0.5 w-24 rounded-full bg-primary-500" />
          <h2 className="text-base font-black uppercase tracking-[0.15em] text-brown-900 sm:text-lg">
            REQUEST FORM
          </h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-brown-500">
            (<span className="font-semibold text-brown-800">{escapeHtml(request.requestedByName)}</span>)
          </p>
        </div>

        {/* Purpose / Department / Date */}
        <div className="border-b border-brown-200 px-6 py-4 sm:px-10">
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-12">
            <div className="sm:col-span-5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-brown-600">Purpose</label>
              <p className="mt-1 text-sm leading-5 text-brown-700 line-clamp-2">{escapeHtml(request.purpose ?? "")}</p>
            </div>

            <div className="sm:col-span-4">
              <label className="text-[11px] font-bold uppercase tracking-wider text-brown-600">Department</label>
              <p className="mt-1 text-sm font-semibold text-brown-700">{escapeHtml(request.department ?? "")}</p>
            </div>

            <div className="sm:col-span-3">
              <label className="text-[11px] font-bold uppercase tracking-wider text-brown-600">Date</label>
              <p className="mt-1 text-sm font-semibold text-brown-700">{request.dateNeeded ? formatDateLong(request.dateNeeded) : "-"}</p>
            </div>
          </div>
        </div>

        {/* Item table */}
        <div className="px-6 py-4 sm:px-10">
          <div className="overflow-x-auto rounded-2xl border border-brown-200">
            <table className="w-full border-collapse table-fixed text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-brown-200 bg-brown-100">
                  <th className="border-r border-brown-200 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-brown-600 sm:w-[40px]">Qty</th>
                  <th className="border-r border-brown-200 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-brown-600">Item / Description</th>
                  <th className="border-r border-brown-200 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-brown-600 sm:w-[110px]">Unit Cost</th>
                  <th className="border-r-0 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-brown-600 sm:w-[120px]">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {request.items.map((item) => (
                  <tr key={item.requestItemId} className="border-b border-brown-200 align-top">
                    <td className="border-r border-brown-200 px-2 py-3 text-right align-top sm:w-[40px]">
                      <span className="block text-xs font-bold text-brown-900">{item.quantityRequested}</span>
                    </td>
                    <td className="border-r border-brown-200 px-2 py-3 align-top">
                      <div className="flex min-w-0 items-start gap-2">
                        <img
                          src={item.supplyId === null ? '/sfcg-logo.jpg' : (item.imagePath || 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=320&h=320&fit=crop')}
                          alt={escapeHtml(item.name)}
                          className="mt-0.5 h-7 w-7 flex-shrink-0 rounded object-cover"
                        />
                        <div className="min-w-0">
                          <p className="break-words text-xs font-semibold leading-5 text-brown-900 sm:text-sm">{escapeHtml(item.name)}</p>
                          {item.supplyId === null ? (
                            <span className="mt-1 inline-block rounded-full bg-accent-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-600">Custom</span>
                          ) : (
                            <span className="mt-1 block text-[10px] font-medium text-brown-400">{escapeHtml(item.itemCode)}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="border-r border-brown-200 px-2 py-3 text-right align-top">
                      <span className="text-[10px] font-bold text-brown-900 sm:text-xs">₱{Number(item.unitCost).toFixed(2)}</span>
                    </td>
                    <td className="px-2 py-3 text-right align-top">
                      <span className="text-sm font-black text-brown-900 sm:text-xs">₱{Number(item.totalAmount).toFixed(2)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-white font-bold">
                  <td colSpan={2} className="border-r border-brown-200 px-3 py-2">
                    <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-brown-600">
                      SOF:
                      <span className="inline-block min-w-[120px] border-b border-brown-300">&nbsp;</span>
                    </span>
                  </td>
                  <td className="border-r border-brown-200 px-3 py-2 text-right text-[11px] uppercase tracking-wider text-brown-600">
                    Grand Total
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-black text-brown-900 sm:text-base">
                    ₱{Number(request.grandTotal).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Total Items / Quantity */}
            <p className="mt-3 text-[10px] uppercase tracking-wider text-brown-400">
              Total Items: {request.totalItems} | Total Quantity: {request.totalQuantity}
            </p>
          </div>

          {/* Approval signatures table */}
          <div className="border-t border-brown-200 px-6 py-4 sm:px-10">
            <div className="overflow-x-auto rounded-2xl border border-brown-200">
              <table className="w-full border-collapse text-[10px] sm:text-xs">
                <thead>
                  <tr className="border-b border-brown-200 bg-brown-100">
                    {["Requested By", "Recommended By", "Checked By", "Noted By", "Approved By"].map((label) => (
                      <th key={label} className="border-r border-brown-200 px-2 py-2 text-center font-bold uppercase tracking-wider text-brown-600 last:border-r-0">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {["Requested", "Recommended", "Checked", "Noted", "Approved"].map((label, index) => {
                      let printedName = ""
                      if (label === "Requested") printedName = escapeHtml(request.requestedByName)
                      else if (label === "Recommended") {
                        // In a real app, we'd fetch approval personnel, but for now we'll use placeholder
                        printedName = escapeHtml("To be filled by Immediate Head")
                      } else if (label === "Checked") {
                        printedName = escapeHtml("To be filled by Resource Planning Officer")
                      } else if (label === "Noted") {
                        printedName = escapeHtml("To be filled by Vice President for Finance")
                      } else if (label === "Approved") {
                        printedName = escapeHtml(request.fulfilledByName || "To be filled by College President")
                      }

                      const position = label === "Recommended" ? "Immediate Head"
                                        : label === "Checked" ? "Resource Planning Officer"
                                        : label === "Noted" ? "Vice President for Finance"
                                        : label === "Approved" ? "College President"
                                        : ""

                      return (
                        <td key={index} className={`border-r border-brown-200 px-2 py-4 text-center last:border-r-0`}>
                          <div className="mx-auto mb-2 h-px w-3/4 border-t border-brown-300" />
                          <p className="text-[9px] uppercase tracking-wider text-brown-400 sm:text-[10px]">Signature</p>
                          <p className="mt-3 text-[10px] sm:text-xs">{printedName}</p>
                          <div className="mx-auto mt-1 h-px w-3/4 border-t border-brown-300" />
                          <p className="mt-1 text-[9px] uppercase tracking-wider text-brown-400 sm:text-[10px]">Printed Name</p>
                          <div className="mx-auto mt-1 h-px w-3/4 border-t border-brown-300" />
                          <p className="mt-2 text-[10px] sm:text-xs">{position}</p>
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Rejection details if any */}
          <div className="border-t border-brown-200 px-6 py-4 sm:px-10">
            {request.status === "Rejected" ? (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-rose-600">Rejection Details</p>
                <p className="mt-2 text-sm font-semibold text-brown-900">Rejected by: {escapeHtml(request.reviewedByRole ?? "Unknown")}</p>
                {request.rejectionReason?.trim() || request.reviewNotes?.trim() ? (
                  <p className="mt-2 text-sm leading-6 text-brown-700">
                    <span className="font-bold text-brown-900">Reason:</span> {escapeHtml(request.rejectionReason?.trim() ?? request.reviewNotes?.trim())}
                  </p>
                ) : ''}
              </div>
            ) : ''}
            <div className="mb-4">
              <label className="text-[11px] font-bold uppercase tracking-wider text-brown-600">Notes / Remarks</label>
              <p className="mt-1 text-sm leading-6 text-brown-600">{escapeHtml(request.notes ?? "")}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default PrintIssuanceSlipPage