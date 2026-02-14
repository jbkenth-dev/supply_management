import AppShell from "../layout/AppShell"
import { suppliers } from "../data/suppliers"
import { Link } from "react-router-dom"

export default function Suppliers() {
  return (
    <AppShell>
      <div className="rounded-lg border bg-white p-4">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <Th>Name</Th>
                <Th>Contact</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>Status</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <Td>{s.name}</Td>
                  <Td>{s.contactName}</Td>
                  <Td>{s.email}</Td>
                  <Td>{s.phone}</Td>
                  <Td>
                    <span
                      className={`inline-flex rounded-md px-2 py-1 text-xs ring-1 ring-inset ${
                        s.status === "Active"
                          ? "bg-green-50 text-green-700 ring-green-600/20"
                          : "bg-amber-50 text-amber-700 ring-amber-600/20"
                      }`}
                    >
                      {s.status}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <Link to={`/suppliers/${s.id}`} className="text-blue-600 hover:underline text-sm">
                      View
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-2 text-left text-xs font-medium text-gray-700 ${className}`}>{children}</th>
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2 text-sm text-gray-700 ${className}`}>{children}</td>
}
