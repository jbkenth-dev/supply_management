import { useEffect, useState } from "react";
import SupplyItem from "./SupplyItem";
import { LoadingState } from "../ui";
import { motion, AnimatePresence } from "framer-motion";
import { CubeIcon } from "@heroicons/react/24/outline";
import type { SupplyItem as PublicSupplyItem } from "../../types/adminInventory";

export default function SupplyList({ searchTerm, selectedCategory }: { searchTerm: string; selectedCategory: string }) {
  const [loading, setLoading] = useState(true);
  const [supplies, setSupplies] = useState<PublicSupplyItem[]>([]);

  useEffect(() => {
    let cancelled = false

    const loadSupplies = async () => {
      setLoading(true)

      try {
        const response = await fetch("/api/public-supplies.php")
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.message ?? "Unable to load supplies.")
        }

        if (!cancelled) {
          setSupplies(result.supplies ?? [])
        }
      } catch {
        if (!cancelled) {
          setSupplies([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSupplies()

    return () => {
      cancelled = true
    }
  }, []);

  const filteredSupplies = supplies.filter((supply) => {
    const matchesSearch = supply.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supply.categoryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supply.itemCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || supply.categoryName === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-10">

      {loading ? (
        <LoadingState type="cards" count={8} />
      ) : (
        <motion.div
          layout
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <AnimatePresence mode="popLayout">
            {filteredSupplies.map((supply, index) => (
              <motion.div
                key={supply.itemCode}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.05,
                  ease: "easeOut"
                }}
              >
                <SupplyItem supply={supply} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {!loading && filteredSupplies.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-dashed border-slate-300 py-20 text-center"
        >
          <div className="inline-flex items-center justify-center p-4 bg-slate-50 rounded-full mb-6">
            <CubeIcon className="h-12 w-12 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No matching supplies</h3>
          <p className="text-slate-500 max-w-sm mx-auto">
            We couldn't find any supplies matching your search or filter criteria.
            Try clearing your filters or searching for something else.
          </p>
          <button
            onClick={() => {}} // Could add clear filters here
            className="mt-8 text-primary-600 font-semibold hover:text-primary-700 transition-colors"
          >
            Clear all filters
          </button>
        </motion.div>
      )}
    </div>
  );
}
