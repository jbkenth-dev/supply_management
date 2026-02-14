import AppShell from "../layout/AppShell"
import { useState } from "react"

export default function Settings() {
  const [profile, setProfile] = useState({ name: "Fatima Ali", email: "fatima.ali@sfc-g.com" })
  const [prefs, setPrefs] = useState({ density: "Comfortable", theme: "Light" })
  const [notif, setNotif] = useState({ lowStock: true, outOfStock: true, supplierOnHold: true })

  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <h3 className="mb-3 text-sm font-medium text-gray-700">Profile</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">Name</label>
              <input
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="mt-1 w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Email</label>
              <input
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="mt-1 w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <button className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Save</button>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <h3 className="mb-3 text-sm font-medium text-gray-700">Preferences</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">Density</label>
              <select
                value={prefs.density}
                onChange={(e) => setPrefs({ ...prefs, density: e.target.value })}
                className="mt-1 w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option>Comfortable</option>
                <option>Compact</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Theme</label>
              <select
                value={prefs.theme}
                onChange={(e) => setPrefs({ ...prefs, theme: e.target.value })}
                className="mt-1 w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option>Light</option>
                <option>Dark</option>
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <h3 className="mb-3 text-sm font-medium text-gray-700">Notifications</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={notif.lowStock} onChange={(e) => setNotif({ ...notif, lowStock: e.target.checked })} />
              <span className="text-sm text-gray-800">Low stock alerts</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={notif.outOfStock} onChange={(e) => setNotif({ ...notif, outOfStock: e.target.checked })} />
              <span className="text-sm text-gray-800">Out of stock alerts</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={notif.supplierOnHold}
                onChange={(e) => setNotif({ ...notif, supplierOnHold: e.target.checked })}
              />
              <span className="text-sm text-gray-800">Supplier on-hold alerts</span>
            </label>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
