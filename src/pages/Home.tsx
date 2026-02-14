import { useState, useEffect } from "react";
import { Button } from "../components/ui/Button";
import { Link } from "react-router-dom";
import SystemOverview from "../components/home/SystemOverview";
import Announcements from "../components/home/Announcements";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Boxes, ChevronDown, Sparkles } from "lucide-react";
import { AnimatedBackground } from "../components/ui/AnimatedBackground";
import { Skeleton } from "../components/ui/Skeleton";
import sfcgBg from "../assets/sfcg-bg.png";

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);
  const scale = useTransform(scrollY, [0, 300], [1, 0.9]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: "easeOut" },
    },
  };

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative h-screen w-full flex items-center justify-center overflow-hidden isolate m-0 p-0 border-none">
        <AnimatedBackground imageUrl={sfcgBg} />

        <motion.div
          style={{ opacity, scale }}
          className="relative z-10 container mx-auto px-4 text-center"
        >
          <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="max-w-5xl mx-auto"
          >
            <motion.h1
              variants={itemVariants}
              className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-8 leading-[1.1]"
            >
              WEB-BASED STOCKS & <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-secondary-400">
                SUPPLY MANAGEMENT
              </span>
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto leading-relaxed font-light"
            >
              Streamline your operations with accurate documentation, real-time updates,
              and seamless coordination across all departments.
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="flex flex-wrap justify-center gap-6"
            >
              <Link to="/auth/login">
                <Button size="xl" className="group px-8 py-6 text-lg rounded-2xl shadow-2xl shadow-primary-500/20">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link to="/supplies">
                <Button
                  size="xl"
                  variant="outline"
                  className="group px-8 py-6 text-lg rounded-2xl border-white/20 bg-white/5 text-white hover:bg-white/10 backdrop-blur-md"
                >
                  <Boxes className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform text-secondary-400" />
                  View Catalog
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/40 animate-bounce cursor-pointer"
        >
          <ChevronDown className="w-8 h-8" />
        </motion.div>
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-24 space-y-32">
        <section>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Comprehensive Solutions</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">Everything you need to manage your inventory efficiently and effectively.</p>
          </div>
          {isLoading ? (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-4">
                  <Skeleton className="h-48 w-full rounded-[2rem]" />
                  <Skeleton className="h-6 w-3/4 mx-auto" />
                  <Skeleton className="h-4 w-5/6 mx-auto" />
                </div>
              ))}
            </div>
          ) : (
            <SystemOverview />
          )}
        </section>

        <section className="bg-white rounded-[3.5rem] p-8 md:p-16 shadow-2xl shadow-slate-200/40 border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary-500/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

          <div className="relative z-10 flex flex-col lg:flex-row items-stretch justify-between gap-16">
            <div className="lg:w-2/5 space-y-8 flex flex-col justify-center">
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 text-primary-600 text-xs font-bold uppercase tracking-widest"
                >
                  <Sparkles className="w-4 h-4" />
                  What's New
                </motion.div>
                <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-[1.1]">
                  Latest <br />
                  <span className="text-primary-600">Announcements</span>
                </h2>
                <p className="text-slate-500 text-lg leading-relaxed max-w-md">
                  Stay updated with the latest changes, features, and important notifications from the management team.
                </p>
              </div>

              <div className="pt-4">
                <Button variant="outline" size="lg" className="rounded-2xl border-slate-200 hover:border-primary-500 hover:bg-primary-50 hover:text-primary-600 group transition-all duration-300">
                  View all notifications
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>

            <div className="lg:w-3/5">
              <Announcements isLoading={isLoading} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
