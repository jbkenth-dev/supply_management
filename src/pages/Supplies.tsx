import { useEffect, useState } from "react";
import SupplyList from "../components/supplies/SupplyList";
import { motion, AnimatePresence } from "framer-motion";
import {
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import { FadeIn, StaggerContainer, StaggerItem } from "../components/ui/animations";

export default function Supplies() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<string[]>(["All"]);

  useEffect(() => {
    let cancelled = false

    const loadCategories = async () => {
      try {
        const response = await fetch("/api/public-supplies.php")
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.message ?? "Unable to load categories.")
        }

        if (!cancelled) {
          setCategories(["All", ...(result.categories ?? [])])
        }
      } catch {
        if (!cancelled) {
          setCategories(["All"])
        }
      }
    }

    void loadCategories()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-white border-b border-slate-100">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary-50/40 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary-50/30 rounded-full blur-3xl" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 relative">
          <StaggerContainer>
            <StaggerItem>
              <div className="flex flex-col items-center">
                <div className="w-full max-w-4xl mx-auto">
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                      <MagnifyingGlassIcon className="h-6 w-6 text-slate-400 group-focus-within:text-primary-500 transition-all duration-300" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search for bond paper, notebooks, pads..."
                      className="w-full pl-14 pr-14 py-6 bg-slate-50/50 border border-slate-200 rounded-[2rem] focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500/50 focus:bg-white transition-all text-xl placeholder:text-slate-400 shadow-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <AnimatePresence>
                      {searchTerm && (
                        <motion.button
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          onClick={() => setSearchTerm("")}
                          className="absolute inset-y-0 right-0 pr-6 flex items-center text-slate-400 hover:text-slate-600"
                        >
                          <XMarkIcon className="h-6 w-6" />
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl border-2 transition-all duration-300 font-bold text-sm ${
                        showFilters
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200'
                          : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <AdjustmentsHorizontalIcon className="h-5 w-5" />
                      Categories
                    </button>
                    <div className="h-8 w-px bg-slate-100 mx-2 hidden sm:block" />
                    <div className="flex flex-wrap justify-center gap-2">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-300 border-2 ${
                            selectedCategory === cat
                              ? 'bg-primary-600 border-primary-600 text-white shadow-xl shadow-primary-100'
                              : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </StaggerItem>
          </StaggerContainer>
        </div>
      </div>

      {/* Content Section */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <FadeIn delay={0.4}>
          <SupplyList searchTerm={searchTerm} selectedCategory={selectedCategory} />
        </FadeIn>
      </main>
    </div>
  );
}
