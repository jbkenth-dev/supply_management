import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  EnvelopeIcon,
  LockClosedIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

const SignUp = () => {
  const [formData, setFormData] = useState({
    firstname: '',
    middlename: '',
    lastname: '',
    email: '',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log(formData);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 sm:p-12">
      <div className="w-full max-w-[520px] bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/60 p-8 sm:p-12 border border-slate-100">
        <div className="mb-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-xl mb-4">
            <img src="/sfcg-logo.jpg" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">SFC-G</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Supply System</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-black text-slate-900 mb-2">Create Account</h2>
            <p className="text-slate-500 font-medium">Register as faculty to start managing supplies.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">First Name</label>
                <input
                  type="text"
                  name="firstname"
                  placeholder="John"
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  required
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Middle Name</label>
                <input
                  type="text"
                  name="middlename"
                  placeholder="D."
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Last Name</label>
                <input
                  type="text"
                  name="lastname"
                  placeholder="Doe"
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary-500 transition-colors">
                    <EnvelopeIcon className="h-5 w-5" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    placeholder="john.doe@university.edu"
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Create Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary-500 transition-colors">
                    <LockClosedIcon className="h-5 w-5" />
                  </div>
                  <input
                    type="password"
                    name="password"
                    placeholder="Min. 8 characters"
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-sm shadow-xl shadow-slate-900/10 hover:bg-slate-800 hover:-translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                Create Faculty Account
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div className="mt-10 text-center">
            <p className="text-sm text-slate-500 font-medium">
              Already have an account?{" "}
              <Link to="/login" className="text-primary-600 font-bold hover:underline">
                Sign In instead
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SignUp;
