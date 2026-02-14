import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/Card";
import {
  BarChart,
  ClipboardList,
  Truck,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: <ClipboardList className="w-6 h-6" />,
    title: "Inventory Tracking",
    description: "Monitor stock levels in real-time with automated low-stock alerts and history.",
    color: "bg-blue-500",
  },
  {
    icon: <Truck className="w-6 h-6" />,
    title: "Supply Chain",
    description: "Seamlessly manage vendor relationships and track incoming shipments.",
    color: "bg-purple-500",
  },
  {
    icon: <BarChart className="w-6 h-6" />,
    title: "Smart Analytics",
    description: "Generate detailed reports and gain actionable insights into usage patterns.",
    color: "bg-emerald-500",
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: "Role Control",
    description: "Granular permission system to ensure secure access for all team members.",
    color: "bg-orange-500",
  },
];

export default function SystemOverview() {
  return (
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
      {features.map((feature, index) => (
        <motion.div
          key={feature.title}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ y: -5 }}
        >
          <Card className="h-full border-none shadow-xl shadow-slate-200/50 bg-white/80 backdrop-blur-sm hover:shadow-2xl hover:shadow-primary-500/10 transition-all duration-300 rounded-[2rem] overflow-hidden group">
            <CardHeader className="pb-4">
              <div className={`w-14 h-14 ${feature.color} rounded-2xl flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform duration-500 shadow-lg shadow-inherit/20`}>
                {feature.icon}
              </div>
              <CardTitle className="text-xl font-bold text-slate-900 group-hover:text-primary-600 transition-colors">
                {feature.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 leading-relaxed">
                {feature.description}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
