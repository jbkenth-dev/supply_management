import AppShell from "../layout/AppShell"
import { users } from "../data/users"

export default function Users() {
  return (
    <AppShell>
      <div className="rounded-lg border bg-white p-4">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-brown-200">
            <thead className="bg-brown-50">
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brown-100 bg-white">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-brown-50">
                  <Td>{u.name}</Td>
                  <Td>{u.email}</Td>
                  <Td>
                    <span
                      className={`inline-flex rounded-md px-2 py-1 text-xs ring-1 ring-inset ${
                        u.role === "Administrator"
                          ? "bg-primary-50 text-primary-700 ring-primary-600/20"
                          : u.role === "Property Custodian"
                          ? "bg-primary-50 text-primary-700 ring-primary-600/20"
                          : "bg-brown-50 text-brown-700 ring-brown-600/20"
                      }`}
                    >
                      {u.role}
                    </span>
                  </Td>
                  <Td>
                    <span
                      className={`inline-flex rounded-md px-2 py-1 text-xs ring-1 ring-inset ${
                        u.status === "Active"
                          ? "bg-green-50 text-green-700 ring-green-600/20"
                          : "bg-red-50 text-red-700 ring-red-600/20"
                      }`}
                    >
                      {u.status}
                    </span>
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

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-2 text-left text-xs font-medium text-brown-700 ${className}`}>{children}</th>
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2 text-sm text-brown-700 ${className}`}>{children}</td>
}
