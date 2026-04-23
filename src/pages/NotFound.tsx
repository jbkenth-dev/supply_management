import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeftIcon, HomeIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

export default function NotFound() {
  return (
    <div className="auth-shell min-h-[70vh] px-6 py-16 sm:px-10">
      <div className="auth-grid" />
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <div className="auth-wave auth-wave-top" />
      <div className="auth-wave auth-wave-bottom" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 mx-auto flex max-w-3xl justify-center"
      >
        <div className="auth-card w-full rounded-[2.5rem] p-8 text-center sm:p-12">
          <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-3xl bg-primary-50 text-primary-600 shadow-lg shadow-primary-100/70">
            <MagnifyingGlassIcon className="h-9 w-9" />
          </div>

          <p className="mt-6 text-sm font-bold uppercase tracking-[0.35em] text-primary-600">404 Error</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
            This page does not exist
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            The link you opened does not match any page currently available in this system. Please check the URL or
            return to a valid page.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-primary-600/20 transition-all hover:-translate-y-0.5 hover:bg-primary-700"
            >
              <HomeIcon className="h-4 w-4" />
              Go to Home
            </Link>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-6 py-3.5 text-sm font-bold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Go Back
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
