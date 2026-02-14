import { Fragment, useState } from "react"
import type { ReactNode } from "react"
import { NavLink } from "react-router-dom"
import { Dialog, Transition } from "@headlessui/react"
import { motion } from "framer-motion"
import {
  Bars3Icon,
  BellIcon,
  ChartBarIcon,
  CubeIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ListBulletIcon,
  TruckIcon,
  DocumentChartBarIcon,
  UsersIcon,
  Cog6ToothIcon,
  XMarkIcon,
  ArrowRightOnRectangleIcon
} from "@heroicons/react/24/outline"

type Props = {
  children: ReactNode
  role?: "Admin" | "Manager" | "Staff"
}

const navGroups = [
  {
    name: "Overview",
    items: [
      { name: "Dashboard", to: "/dashboard", icon: ChartBarIcon },
      { name: "Reports", to: "/reports", icon: DocumentChartBarIcon },
    ]
  },
  {
    name: "Inventory",
    items: [
      { name: "Inventory", to: "/inventory", icon: CubeIcon },
      { name: "Stock In", to: "/stock-in", icon: ArrowDownTrayIcon },
      { name: "Stock Out", to: "/stock-out", icon: ArrowUpTrayIcon },
      { name: "Suppliers", to: "/suppliers", icon: TruckIcon },
    ]
  },
  {
    name: "System",
    items: [
      { name: "Transactions", to: "/transactions", icon: ListBulletIcon },
      { name: "Users", to: "/users", icon: UsersIcon },
      { name: "Settings", to: "/settings", icon: Cog6ToothIcon },
    ]
  }
]

function SidebarContent({ role = "Manager" }: { role?: "Admin" | "Manager" | "Staff" }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white border-r border-gray-200">
      <div className="flex h-16 flex-shrink-0 items-center px-6 border-b border-gray-100">
        <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          SFC-G
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
        {navGroups.map((group) => (
          <div key={group.name}>
            <h3 className="mb-2 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {group.name}
            </h3>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.to}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-blue-50 text-blue-700 shadow-sm"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        className={`h-5 w-5 flex-shrink-0 transition-colors ${
                          isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
                        }`}
                      />
                      <span>{item.name}</span>
                      {isActive && (
                        <motion.div
                          layoutId="activeSidebar"
                          className="absolute left-0 h-8 w-1 bg-blue-600 rounded-r-full"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      
      {/* User Profile Section */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center gap-3 rounded-xl p-2 hover:bg-gray-50 transition-colors cursor-pointer group">
          <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm">
            JD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">John Doe</p>
            <p className="text-xs text-gray-500 truncate">{role}</p>
          </div>
          <ArrowRightOnRectangleIcon className="h-5 w-5 text-gray-400 group-hover:text-red-500 transition-colors" />
        </div>
      </div>
    </div>
  )
}

export default function AppShell({ children, role = "Manager" }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile Sidebar */}
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setSidebarOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                <Transition.Child
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                    <button type="button" className="-m-2.5 p-2.5" onClick={() => setSidebarOpen(false)}>
                      <span className="sr-only">Close sidebar</span>
                      <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                    </button>
                  </div>
                </Transition.Child>
                <SidebarContent role={role} />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <SidebarContent role={role} />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col lg:pl-72 transition-all duration-300">
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white/80 backdrop-blur-lg px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
          </button>

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1"></div>
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* Notifications */}
              <button type="button" className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500 relative">
                <span className="sr-only">View notifications</span>
                <BellIcon className="h-6 w-6" aria-hidden="true" />
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
              </button>
              
              {/* Separator */}
              <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200" aria-hidden="true" />

              {/* Profile dropdown (Simplified for now since it's in sidebar too, but good for mobile/desktop parity or quick actions) */}
              <div className="flex items-center gap-x-4 lg:hidden">
                <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600">
                  JD
                </div>
              </div>
            </div>
          </div>
        </div>

        <main className="py-8">
          <div className="px-4 sm:px-6 lg:px-8">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  )
}
