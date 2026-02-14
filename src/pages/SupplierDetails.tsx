import { useParams, Link } from "react-router-dom"
import AppShell from "../layout/AppShell"
import { suppliers } from "../data/suppliers"
import { items } from "../data/items"

export default function SupplierDetails() {
  const { id } = useParams()
  const supplier = suppliers.find((s) => s.id === id)
  const suppliedItems = items.filter((i) => i.supplierId === id)

  if (!supplier) {
    return (
      <AppShell>
        <div className="rounded-lg border bg-white p-6 text-center">
          <p className="text-sm text-gray-700">Supplier not found</p>
          <Link to="/suppliers" className="mt-3 inline-block text-blue-600 hover:underline text-sm">
            Back to suppliers
          </Link>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <h3 className="text-sm font-medium text-gray-700">Supplier</h3>
          <div className="mt-3 space-y-2">
            <Info label="Name" value={supplier.name} />
            <Info label="Contact" value={supplier.contactName} />
            <Info label="Email" value={supplier.email} />
            <Info label="Phone" value={supplier.phone} />
            <Info label="Address" value={supplier.address} />
            <Info label="Status" value={supplier.status} />
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4 lg:col-span-2">
          <h3 className="text-sm font-medium text-gray-700">Supplied Items</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <Th>Item Code</Th>
                  <Th>Name</Th>
                  <Th>Category</Th>
                  <Th className="text-right">Qty</Th>
                  <Th>Unit</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {suppliedItems.map((i) => (
                  <tr key={i.itemCode} className="hover:bg-gray-50">
                    <Td>{i.itemCode}</Td>
                    <Td>{i.name}</Td>
                    <Td>{i.category}</Td>
                    <Td className="text-right">{i.quantity.toLocaleString()}</Td>
                    <Td>{i.unit}</Td>
                  </tr>
                ))}
                {suppliedItems.length === 0 && (
                  <tr>
                    <Td colSpan={5} className="text-center text-sm text-gray-600">
                      No items
                    </Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-white p-3">
      <p className="text-xs text-gray-600">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
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
