import { Card } from "../ui/Card";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Bell, ArrowRight, Sparkles, AlertCircle, Info } from "lucide-react";
import { Skeleton } from "../ui/Skeleton";

interface Announcement {
  title: string;
  date: string;
  description: string;
  type: "feature" | "maintenance" | "update";
}

const announcements: Announcement[] = [
  {
    title: "New Feature: Real-time Analytics",
    date: "2026-02-10",
    description: "We've launched a new real-time analytics dashboard to provide you with up-to-the-minute insights.",
    type: "feature",
  },
  {
    title: "System Maintenance",
    date: "2026-02-15",
    description: "We will be performing scheduled maintenance on February 15th from 2:00 AM to 4:00 AM UTC.",
    type: "maintenance",
  },
  {
    title: "New Supplier Integration",
    date: "2026-02-05",
    description: "We've added a new integration with a major supplier to expand our network.",
    type: "update",
  },
];

const getTypeStyles = (type: Announcement["type"]) => {
  switch (type) {
    case "feature":
      return {
        bg: "bg-blue-50",
        text: "text-blue-700",
        icon: <Sparkles className="w-4 h-4" />,
        border: "border-blue-100"
      };
    case "maintenance":
      return {
        bg: "bg-amber-50",
        text: "text-amber-700",
        icon: <AlertCircle className="w-4 h-4" />,
        border: "border-amber-100"
      };
    case "update":
      return {
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        icon: <Info className="w-4 h-4" />,
        border: "border-emerald-100"
      };
    default:
      return {
        bg: "bg-slate-50",
        text: "text-slate-700",
        icon: <Bell className="w-4 h-4" />,
        border: "border-slate-100"
      };
  }
};

export function SkeletonAnnouncements() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4 p-4 rounded-3xl bg-white border border-slate-100">
          <Skeleton height="h-12" width="w-12" className="shrink-0 rounded-2xl" />
          <div className="flex-grow space-y-2">
            <div className="flex justify-between">
              <Skeleton height="h-4" width="w-24" />
              <Skeleton height="h-3" width="w-16" />
            </div>
            <Skeleton height="h-5" width="w-3/4" />
            <Skeleton height="h-4" width="w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Announcements({ isLoading = false }: { isLoading?: boolean }) {
  if (isLoading) return <SkeletonAnnouncements />;

  return (
    <div className="space-y-4">
      <AnimatePresence mode="popLayout">
        {announcements.map((announcement, index) => {
          const styles = getTypeStyles(announcement.type);
          return (
            <motion.div
              key={announcement.title}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              whileHover={{ x: 8 }}
              className="group cursor-pointer"
            >
              <Card className="h-full border border-slate-100 bg-white hover:border-primary-100 hover:shadow-xl hover:shadow-primary-500/5 transition-all duration-300 rounded-[2rem] overflow-hidden">
                <div className="flex items-start gap-4 p-5">
                  <div className={`shrink-0 w-12 h-12 rounded-2xl ${styles.bg} ${styles.text} flex items-center justify-center transition-transform group-hover:scale-110 duration-300`}>
                    {styles.icon}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${styles.text}`}>
                        {announcement.type}
                      </span>
                      <div className="flex items-center text-slate-400 text-[10px] font-bold">
                        <Calendar className="w-3 h-3 mr-1" />
                        {announcement.date}
                      </div>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mb-1 group-hover:text-primary-600 transition-colors line-clamp-1">
                      {announcement.title}
                    </h3>
                    <p className="text-slate-500 text-xs leading-relaxed line-clamp-2">
                      {announcement.description}
                    </p>
                  </div>
                  <div className="shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
