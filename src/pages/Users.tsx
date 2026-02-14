import AppShell from "../layout/AppShell"
import { users } from "../data/users"

export default function Users() {
  return (
    <AppShell>
      <div className="rounded-lg border bg-white p-4">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <Td>{u.name}</Td>
                  <Td>{u.email}</Td>
                  <Td>
                    <span
                      className={`inline-flex rounded-md px-2 py-1 text-xs ring-1 ring-inset ${
                        u.role === "Admin"
                          ? "bg-purple-50 text-purple-700 ring-purple-600/20"
                          : u.role === "Manager"
                          ? "bg-blue-50 text-blue-700 ring-blue-600/20"
                          : "bg-slate-50 text-slate-700 ring-slate-600/20"
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
  return <th className={`px-4 py-2 text-left text-xs font-medium text-gray-700 ${className}`}>{children}</th>
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2 text-sm text-gray-700 ${className}`}>{children}</td>
}
