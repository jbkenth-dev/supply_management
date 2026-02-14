import { useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import {
  HomeIcon,
  CubeIcon,
  InformationCircleIcon,
  Bars3Icon,
  XMarkIcon,
  MagnifyingGlassIcon,
  BellIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  UserPlusIcon
} from "@heroicons/react/24/outline";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "../components/ui";

export default function Layout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const getLinkClass = ({ isActive }: { isActive: boolean }) =>
    `relative flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all duration-300 rounded-full group ${
      isActive
        ? "text-primary-600 bg-primary-50/50 shadow-sm"
        : "text-slate-600 hover:text-primary-600 hover:bg-slate-50"
    }`;

  const activeIndicator = (isActive: boolean) =>
    isActive ? (
      <motion.div
        layoutId="activeNav"
        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary-600"
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
      />
    ) : null;

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 selection:bg-primary-100 selection:text-primary-900">
      <header className="sticky top-0 z-[100] bg-white/70 backdrop-blur-md border-b border-slate-200/60 transition-all duration-300">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <div className="flex items-center gap-8">
              <NavLink to="/" className="flex items-center gap-3 group">
                <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md group-hover:shadow-lg transition-all duration-300">
                  <img
                    src="/sfcg-logo.jpg"
                    alt="SFC-G Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-950 to-slate-700 leading-none">
                  SFC-G
                </span>
              </NavLink>

              <div className="hidden md:flex items-center gap-1">
                <NavLink to="/" className={getLinkClass}>
                  {({ isActive }) => (
                    <>
                      <span>Home</span>
                      {activeIndicator(isActive)}
                    </>
                  )}
                </NavLink>
                <NavLink to="/supplies" className={getLinkClass}>
                  {({ isActive }) => (
                    <>
                      <span>Supplies</span>
                      {activeIndicator(isActive)}
                    </>
                  )}
                </NavLink>
                <NavLink to="/about" className={getLinkClass}>
                  {({ isActive }) => (
                    <>
                      <span>About</span>
                      {activeIndicator(isActive)}
                    </>
                  )}
                </NavLink>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <NavLink to="/login" className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-primary-600 hover:bg-primary-50/50 rounded-full transition-all duration-300">
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
                Login
              </NavLink>
              <NavLink to="/auth/signup">
                <button className="flex items-center gap-2 bg-primary-600 text-white px-7 py-2.5 rounded-full text-sm font-black shadow-xl shadow-primary-500/20 hover:bg-primary-700 hover:shadow-primary-500/30 hover:-translate-y-0.5 transition-all duration-300 active:scale-95 uppercase tracking-wider">
                  <UserPlusIcon className="w-5 h-5" />
                  Get Started
                </button>
              </NavLink>
            </div>

            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                {isMenuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="md:hidden absolute top-24 left-4 right-4 bg-white/90 backdrop-blur-xl border border-white/20 shadow-2xl rounded-[2rem] p-6"
            >
              <div className="flex flex-col gap-2">
                <NavLink
                  to="/"
                  onClick={() => setIsMenuOpen(false)}
                  className={({ isActive }) => `flex items-center gap-3 p-4 rounded-2xl text-lg font-bold transition-all ${isActive ? 'bg-primary-50 text-primary-600' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <HomeIcon className="w-6 h-6" />
                  Home
                </NavLink>
                <NavLink
                  to="/supplies"
                  onClick={() => setIsMenuOpen(false)}
                  className={({ isActive }) => `flex items-center gap-3 p-4 rounded-2xl text-lg font-bold transition-all ${isActive ? 'bg-primary-50 text-primary-600' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <CubeIcon className="w-6 h-6" />
                  Supplies
                </NavLink>
                <NavLink
                  to="/about"
                  onClick={() => setIsMenuOpen(false)}
                  className={({ isActive }) => `flex items-center gap-3 p-4 rounded-2xl text-lg font-bold transition-all ${isActive ? 'bg-primary-50 text-primary-600' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <InformationCircleIcon className="w-6 h-6" />
                  About
                </NavLink>
                <div className="h-px bg-slate-100 my-2" />
                <NavLink
                  to="/login"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 p-4 rounded-2xl text-lg font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  <ArrowRightOnRectangleIcon className="w-6 h-6" />
                  Login
                </NavLink>
                <NavLink
                  to="/auth/signup"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <button className="w-full flex items-center justify-center gap-3 bg-primary-600 text-white p-4 rounded-2xl font-black shadow-lg shadow-primary-500/20 uppercase tracking-widest text-sm">
                    <UserPlusIcon className="w-6 h-6" />
                    Get Started
                  </button>
                </NavLink>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main>
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
    </div>
  );
}
