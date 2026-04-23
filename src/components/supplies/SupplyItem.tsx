import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/Card";
import { CubeIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import type { SupplyItem as PublicSupplyItem } from "../../types/adminInventory";

export default function SupplyItem({ supply }: { supply: PublicSupplyItem }) {
  const [loaded, setLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const getStatusStyles = (quantity: number) => {
    if (quantity === 0) return {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-100',
      dot: 'bg-rose-500',
      label: 'Out of Stock'
    };
    if (quantity <= 10) return {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-100',
      dot: 'bg-amber-500',
      label: 'Low Stock'
    };
    return {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-100',
      dot: 'bg-emerald-500',
      label: 'In Stock'
    };
  };

  const status = getStatusStyles(supply.quantityOnHand);

  return (
    <Link to={`/supplies/${supply.itemCode}`} className="group h-full block">
      <Card className="h-full flex flex-col overflow-hidden border-slate-100 group-hover:border-primary-200 group-hover:shadow-2xl group-hover:shadow-slate-200/60 transition-all duration-500 rounded-[2.5rem] bg-white">
        <CardHeader className="p-0 relative">
          <div className="relative aspect-[4/3] overflow-hidden m-3 rounded-[2rem]">
            {!loaded && (
              <div className="absolute inset-0 bg-slate-100 animate-pulse" />
            )}
            <img
              src={imageError ? "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop" : (supply.imagePath || "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop")}
              alt={supply.name}
              loading="lazy"
              onLoad={() => setLoaded(true)}
              onError={() => setImageError(true)}
              className={`w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 ${
                loaded ? "opacity-100" : "opacity-0"
            }`}
          />
          <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {/* View Details Indicator */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0">
            <div className="bg-white/95 backdrop-blur-md px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">View Details</span>
              <ArrowRightIcon className="h-4 w-4 text-primary-600" />
            </div>
          </div>

          {/* Category Badge on Image */}
          <div className="absolute top-4 left-4">
            <span className="px-4 py-1.5 bg-white/95 backdrop-blur-md text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm border border-slate-100">
              {supply.categoryName}
            </span>
          </div>
          </div>
        </CardHeader>

        <CardContent className="flex-grow px-6 pb-6 pt-2">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {supply.itemCode}
            </span>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${status.bg} ${status.text} ${status.border}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${status.dot} animate-pulse`} />
              <span className="text-[10px] font-black uppercase tracking-wider">
                {status.label}
              </span>
            </div>
          </div>

          <CardTitle className="text-xl font-black text-slate-900 mb-3 group-hover:text-primary-600 transition-colors line-clamp-1 tracking-tight">
            {supply.name}
          </CardTitle>

          <div className="flex items-center justify-between mb-6">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Available Stock</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-slate-900 tracking-tighter">{supply.quantityOnHand}</span>
              </div>
            </div>
            
            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-primary-50 transition-colors border border-slate-100 group-hover:border-primary-100">
              <CubeIcon className="h-6 w-6 text-slate-400 group-hover:text-primary-500 transition-colors" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <span>Stock Level</span>
              <span>{Math.round(Math.min((supply.quantityOnHand / 100) * 100, 100))}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden p-0.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((supply.quantityOnHand / 100) * 100, 100)}%` }}
                transition={{ duration: 1.5, ease: "circOut" }}
                className={`h-full rounded-full ${
                  supply.quantityOnHand > 10 ? 'bg-emerald-500' :
                  supply.quantityOnHand > 0 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
