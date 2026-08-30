import { useEffect, useState } from "react";
import { formatDateLong } from "../lib/date";
import { XCircleIcon } from "@heroicons/react/24/outline";
import type { FacultyRequest } from "../types/requests";

type CartItem = {
  supplyId: number | null;
  name: string;
  itemCode: string;
  imagePath: string;
  categoryName: string;
  quantity: number;
  unitCost: number;
  totalAmount: number;
  isCustom: boolean;
  customItemName: string;
  maxStock: number | null;
};

type RequestViewModalProps = {
  request: FacultyRequest;
  open: boolean;
  onClose: () => void;
};

export default function RequestViewModal({
  request,
  open,
  onClose,
}: RequestViewModalProps) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const cartItems: CartItem[] = request.items.map((item) => ({
      supplyId: item.supplyId,
      name: item.name,
      itemCode: item.itemCode,
      imagePath: item.imagePath,
      categoryName: item.categoryName,
      quantity: item.quantityRequested,
      unitCost: item.unitCost,
      totalAmount: item.totalAmount,
      isCustom: item.supplyId === null,
      customItemName: item.customItemName ?? "",
      maxStock: item.quantityOnHand,
    }));
    setItems(cartItems);
  }, [request.items]);

  const grandTotal = request.grandTotal;
  const totalQuantity = request.totalQuantity;
  const totalItems = request.totalItems;

  const handleClose = () => {
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-950/55 p-4 backdrop-blur-sm" onClick={handleClose}>
      <div className="relative w-full max-w-[210mm] max-h-[calc(100vh_-_3rem)] overflow-y-auto rounded-[1.75rem] border border-brown-200 bg-white shadow-sm" onClick={(e) => e.stopPropagation()}>
        <button onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }} className="absolute top-2 right-2 rounded-xl p-2 text-brown-700 hover:text-brown-900 hover:bg-brown-50 transition" aria-label="Close">
          <XCircleIcon className="h-5 w-5" />
        </button>
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
            (<span className="font-semibold text-brown-800">
              {request.requestedByName}
            </span>)
          </p>
        </div>

        <div className="border-b border-brown-200 px-6 py-4 sm:px-10">
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-12">
            <div className="sm:col-span-5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-brown-600">
                Purpose <span className="text-rose-600">*</span>
              </label>
              <p className="mt-1 text-sm leading-5 text-brown-700 line-clamp-2">{request.purpose}</p>
            </div>

            <div className="sm:col-span-4">
              <label className="text-[11px] font-bold uppercase tracking-wider text-brown-600">
                Department <span className="text-rose-600">*</span>
              </label>
              <p className="mt-1 text-sm font-semibold text-brown-700">{request.department}</p>
            </div>

            <div className="sm:col-span-3">
              <label className="text-[11px] font-bold uppercase tracking-wider text-brown-600">
                Date <span className="text-rose-600">*</span>
              </label>
              <p className="mt-1 text-sm font-semibold text-brown-700">
                {request.dateNeeded ? formatDateLong(request.dateNeeded) : "-"}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 sm:px-10">
          <div className="overflow-x-auto rounded-2xl border border-brown-200">
            <table className="w-full border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-brown-200 bg-brown-100">
                  <th className="border-r border-brown-200 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-brown-600 sm:w-[60px]">
                    Qty
                  </th>
                  <th className="border-r border-brown-200 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-brown-600">
                    Item / Description
                  </th>
                  <th className="border-r border-brown-200 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-brown-600 sm:w-[110px]">
                    Unit Cost
                  </th>
                  <th className="border-r-0 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-brown-600 sm:w-[120px]">
                    Total Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr className="border-b border-brown-200">
                    <td colSpan={4} className="px-4 py-8 text-center text-sm italic text-brown-400">
                      No items in this request.
                    </td>
                  </tr>
                ) : null}

                {items.map((item, index) => (
                  <tr key={`${item.itemCode}-${index}`} className="border-b border-brown-200">
                    <td className="border-r border-brown-200 px-2 py-2 flex items-center gap-1">
                      <span className="text-xs font-bold text-brown-900">{item.quantity}</span>
                    </td>
                    <td className="border-r border-brown-200 px-2 py-2 flex items-center gap-2">
                      <img
                        src={item.imagePath || "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=320&h=320&fit=crop"}
                        alt={item.name}
                        className="h-6 w-6 object-cover rounded"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-brown-900 sm:text-sm">{item.name}</p>
                        {item.isCustom ? (
                          <span className="inline-block rounded-full bg-accent-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-600">
                            Custom
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-brown-400">{item.itemCode}</span>
                        )}
                      </div>
                    </td>
                    <td className="border-r border-brown-200 px-2 py-2 text-right text-[10px] font-semibold text-brown-400 sm:text-xs">
                      PHP {item.unitCost.toFixed(2)}
                    </td>
                    <td className="border-r-0 px-2 py-2 text-right text-sm font-bold text-brown-900 sm:text-sm">
                      PHP {item.totalAmount.toFixed(2)}
                    </td>
                  </tr>
                ))}

                {items.length > 0 && items.length < 5 ? Array.from({ length: Math.min(5 - items.length, 3) }).map((_, i) => (
                  <tr key={`empty-${i}`} className="h-8 border-b border-brown-100">
                    <td colSpan={4} />
                  </tr>
                )) : null}

                <tr className="border-b border-brown-200 bg-brown-50">
                  <td colSpan={4} className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* No add item buttons in view mode */}
                    </div>
                  </td>
                </tr>

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
                    PHP {grandTotal.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[10px] uppercase tracking-wider text-brown-400">
            Total Items: {totalItems} | Total Quantity: {totalQuantity}
          </p>
        </div>

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
                  {["Requested", "Recommended", "Checked", "Noted", "Approved"].map((label) => {
                    let printedName = "";
                    if (label === "Requested") {
                      printedName = request.requestedByName;
                    }
                    const position = label === "Recommended"
                      ? "Immediate Head"
                      : label === "Checked"
                      ? "Resource Planning Officer"
                      : label === "Noted"
                      ? "Vice President for Finance"
                      : label === "Approved"
                      ? "College President"
                      : "";
                    return (
                      <td key={label} className="border-r border-brown-200 px-2 py-4 text-center last:border-r-0">
                        <div className="mx-auto mb-2 h-px w-3/4 border-t border-brown-300" />
                        <p className="text-[9px] uppercase tracking-wider text-brown-400 sm:text-[10px]">Signature</p>
                        <p className="mt-3 text-[10px] sm:text-xs">{printedName}</p>
                        <div className="mx-auto mt-1 h-px w-full border-t border-brown-300" />
                        <p className="mt-1 text-[9px] uppercase tracking-wider text-brown-400 sm:text-[10px]">Printed Name</p>
                        <p className="mt-2 text-[10px] sm:text-xs">{position}</p>
                        <div className="mx-auto mt-1 h-px w-full border-t border-brown-300" />
                        <p className="mt-1 text-[9px] uppercase tracking-wider text-brown-400 sm:text-[10px]">Position / Designation</p>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t border-brown-200 px-6 py-4 sm:px-10">
          <div className="mb-4">
            <label className="text-[11px] font-bold uppercase tracking-wider text-brown-600">Notes / Remarks</label>
            <p className="mt-1 text-sm leading-6 text-brown-600">{request.notes}</p>
          </div>
        </div>
      </div>
    </div>
  );
}