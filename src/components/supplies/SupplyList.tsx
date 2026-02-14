import { useEffect, useState } from "react";
import SupplyItem from "./SupplyItem";
import { LoadingState } from "../ui";
import { motion, AnimatePresence } from "framer-motion";
import { CubeIcon } from "@heroicons/react/24/outline";
import { items as realItems } from "../../data/items";

export default function SupplyList({ searchTerm, selectedCategory }: { searchTerm: string; selectedCategory: string }) {
  const [loading, setLoading] = useState(true);
  const [supplies, setSupplies] = useState(realItems);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      setSupplies(realItems);
      setLoading(false);
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  const filteredSupplies = supplies.filter((supply) => {
    const matchesSearch = supply.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supply.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || supply.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            Supplies
          </h2>
          <p className="text-slate-500 text-sm font-medium mt-1">
            Viewing {filteredSupplies.length} {filteredSupplies.length === 1 ? 'paper product' : 'paper products'} in this collection
          </p>
        </div>
      </div>

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
