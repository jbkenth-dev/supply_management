import { useMemo, useState, useEffect } from "react"
import AppShell from "../layout/AppShell"
import { items } from "../data/items"
import type { Item } from "../data/items"

import { motion } from "framer-motion"
import { StaggerContainer, StaggerItem, FadeIn } from "../components/ui/animations"
import { Button } from "../components/ui"
import { LoadingState } from "../components/ui/LoadingStates"
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowsUpDownIcon,
  CubeIcon,
  PlusIcon,
  EyeIcon,
  PencilIcon
} from "@heroicons/react/24/outline"

export default function Inventory() {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("All")
  const [sortBy, setSortBy] = useState<"name" | "quantity" | "status">("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [loading, setLoading] = useState(true)
  const [inventoryData, setInventoryData] = useState<Item[]>([])

  useEffect(() => {
    // Simulate data loading
    const timer = setTimeout(() => {
      setInventoryData(items)
      setLoading(false)
    }, 1500) // 1.5 second delay to show loading state

    return () => clearTimeout(timer)
  }, [])

  const categories = useMemo(() => ["All", ...Array.from(new Set(inventoryData.map((i) => i.category)))], [inventoryData])

  const filtered = useMemo(() => {
    if (loading) return []

    const data = inventoryData.filter((i) => {
      const matchesQuery =
        i.name.toLowerCase().includes(query.toLowerCase()) || i.itemCode.toLowerCase().includes(query.toLowerCase())
      const matchesCategory = category === "All" || i.category === category
      return matchesQuery && matchesCategory
    })
    data.sort((a, b) => compare(a, b, sortBy, sortDir))
    return data
  }, [query, category, sortBy, sortDir, inventoryData, loading])

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
              <p className="text-gray-600 mt-1">Manage your stock and track inventory levels</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" size="md" loading>
                <ArrowsUpDownIcon className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="primary" size="md" loading>
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </div>

          <LoadingState type="inventory" count={10} />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <FadeIn>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
              <p className="text-gray-600 mt-1">Manage your stock and track inventory levels</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" size="md">
                <ArrowsUpDownIcon className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="primary" size="md">
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <StaggerContainer className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <StaggerItem className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by item code or name..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                />
              </div>

              <div className="flex gap-3">
                <div className="relative">
                  <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="pl-9 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "name" | "quantity" | "status")}
                    className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  >
                    <option value="name">Name</option>
                    <option value="quantity">Quantity</option>
                    <option value="status">Status</option>
                  </select>
                  <select
                    value={sortDir}
                    onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
                    className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  >
                    <option value="asc">↑ Asc</option>
                    <option value="desc">↓ Desc</option>
                  </select>
                </div>
              </div>
            </StaggerItem>

            <StaggerItem className="mt-4">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Showing {filtered.length} of {items.length} items</span>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {items.filter(i => i.status === "In Stock").length} In Stock
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                    {items.filter(i => i.status === "Low").length} Low
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {items.filter(i => i.status === "Out").length} Out
                  </span>
                </div>
              </div>
            </StaggerItem>
          </StaggerContainer>

          {/* Table */}
          <StaggerItem>
            <motion.div
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <Th>Item Code</Th>
                      <Th>Item Name</Th>
                      <Th>Category</Th>
                      <Th className="text-right">Quantity</Th>
                      <Th>Unit</Th>
                      <Th>Supplier</Th>
                      <Th>Status</Th>
                      <Th className="text-right">Actions</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filtered.map((item, index) => (
                      <motion.tr
                        key={item.itemCode}
                        className="hover:bg-gray-50 transition-colors duration-150"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Td className="font-mono text-sm font-medium text-gray-900">{item.itemCode}</Td>
                        <Td>
                          <div className="font-medium text-gray-900">{item.name}</div>
                          <div className="text-xs text-gray-500">{item.category}</div>
                        </Td>
                        <Td>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {item.category}
                          </span>
                        </Td>
                        <Td className="text-right">
                          <div className="font-medium text-gray-900">{item.quantity.toLocaleString()}</div>
                          <div className="text-xs text-gray-500">Min: {item.reorderLevel}</div>
                        </Td>
                        <Td>
                          <span className="text-sm text-gray-600">{item.unit}</span>
                        </Td>
                        <Td>
                          <span className="text-sm text-gray-600">{item.supplierId}</span>
                        </Td>
                        <Td>
                          <StatusBadge status={item.status} />
                        </Td>
                        <Td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-50"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </motion.button>
                          </div>
                        </Td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filtered.length === 0 && (
                <div className="text-center py-12">
                  <CubeIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No items found</h3>
                  <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filter criteria.</p>
                </div>
              )}
            </motion.div>
          </StaggerItem>
        </div>
      </FadeIn>
    </AppShell>
  )
}

function compare(a: Item, b: Item, by: "name" | "quantity" | "status", dir: "asc" | "desc") {
  let r = 0
  if (by === "name") r = a.name.localeCompare(b.name)
  if (by === "status") r = a.status.localeCompare(b.status)
  if (by === "quantity") r = a.quantity - b.quantity
  return dir === "asc" ? r : -r
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${className}`}>
      {children}
    </th>
  )
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${className}`}>
      {children}
    </td>
  )
}

function StatusBadge({ status }: { status: Item["status"] }) {
  const map: Record<Item["status"], { bg: string; text: string; ring: string }> = {
    "In Stock": { bg: "bg-green-100", text: "text-green-800", ring: "ring-green-600/20" },
    Low: { bg: "bg-amber-100", text: "text-amber-800", ring: "ring-amber-600/20" },
    Out: { bg: "bg-red-100", text: "text-red-800", ring: "ring-red-600/20" },
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status].bg} ${map[status].text} ring-1 ring-inset ${map[status].ring}`}>
      {status}
    </span>
  )
}
