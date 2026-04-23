import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  UserIcon,
} from "@heroicons/react/24/outline";

type AdminCreateErrors = Partial<
  Record<
    | "firstname"
    | "middlename"
    | "lastname"
    | "username"
    | "email"
    | "password"
    | "confirmPassword",
    string
  >
>;

type AdminCreateForm = {
  firstname: string;
  middlename: string;
  lastname: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const initialForm: AdminCreateForm = {
  firstname: "",
  middlename: "",
  lastname: "",
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const standards = [
  "Stored directly in the existing users table with the Administrator role.",
  "Uses the same validation rules as the current auth flow for consistent data quality.",
  "Applies secure password hashing in PHP before saving to the database.",
];

export default function AdminCreate() {
  const [formData, setFormData] = useState<AdminCreateForm>(initialForm);
  const [errors, setErrors] = useState<AdminCreateErrors>({});
  const [serverMessage, setServerMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
    setErrors((current) => ({
      ...current,
      [name]: "",
    }));
    setServerMessage("");
    setIsSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerMessage("");
    setIsSuccess(false);

    if (formData.password !== formData.confirmPassword) {
      setErrors((current) => ({
        ...current,
        confirmPassword: "Passwords do not match.",
      }));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin-create.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrors(result.errors ?? {});
        setServerMessage(result.message ?? "Unable to create administrator account.");
        return;
      }

      setErrors({});
      setServerMessage(result.message ?? "Administrator account created successfully.");
      setIsSuccess(true);
      setFormData(initialForm);
    } catch {
      setServerMessage(
        "Unable to connect to the PHP admin creation service. Make sure Apache and MySQL are running in XAMPP.",
      );
      setIsSuccess(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-shell min-h-screen px-6 py-8 sm:px-10 lg:px-16">
      <div className="auth-grid" />
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <div className="auth-wave auth-wave-top" />
      <div className="auth-wave auth-wave-bottom" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.section
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="flex flex-col justify-center rounded-[2.5rem] border border-white/70 bg-white/55 p-8 shadow-[0_32px_80px_rgba(37,99,235,0.08)] backdrop-blur-xl sm:p-10 lg:p-12"
          >
            <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-primary-700">
              <ShieldCheckIcon className="h-4 w-4" />
              Administrator Setup
            </span>

            <h1 className="max-w-xl text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
              Create an administrator account with complete and accurate profile details.
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Use this page to register the main system administrator in the database. The account is saved with the
              official <span className="font-semibold text-slate-900">Administrator</span> role and is immediately
              compatible with the existing login flow.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {standards.map((item) => (
                <div
                  key={item}
                  className="rounded-3xl border border-white/70 bg-white/70 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]"
                >
                  <CheckCircleIcon className="h-6 w-6 text-primary-600" />
                  <p className="mt-3 text-sm font-medium leading-6 text-slate-600">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4 text-sm font-medium text-slate-500">
              <span className="rounded-full border border-slate-200 bg-white/70 px-4 py-2">Role locked to Administrator</span>
              <span className="rounded-full border border-slate-200 bg-white/70 px-4 py-2">Username and email uniqueness enforced</span>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="auth-card w-full rounded-[2.5rem] p-8 sm:p-10"
          >
            <div className="mb-8">
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-primary-600">Admin Account</p>
              <h2 className="mt-3 text-3xl font-black text-slate-900">Professional account setup</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Enter the administrator's official identity and credentials. This record will be saved to the database
                as a production-ready login.
              </p>
            </div>

            {serverMessage ? (
              <div
                className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-medium ${
                  isSuccess
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {serverMessage}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstname"
                    value={formData.firstname}
                    onChange={handleChange}
                    placeholder="Maria"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    required
                  />
                  {errors.firstname ? <p className="mt-2 text-xs font-semibold text-rose-600">{errors.firstname}</p> : null}
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    name="middlename"
                    value={formData.middlename}
                    onChange={handleChange}
                    placeholder="S."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastname"
                    value={formData.lastname}
                    onChange={handleChange}
                    placeholder="Dela Cruz"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    required
                  />
                  {errors.lastname ? <p className="mt-2 text-xs font-semibold text-rose-600">{errors.lastname}</p> : null}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Username</label>
                <div className="group relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 transition-colors group-focus-within:text-primary-500">
                    <UserIcon className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="admin.mdelacruz"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    required
                  />
                </div>
                {errors.username ? <p className="mt-2 text-xs font-semibold text-rose-600">{errors.username}</p> : null}
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</label>
                <div className="group relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 transition-colors group-focus-within:text-primary-500">
                    <EnvelopeIcon className="h-5 w-5" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="admin@supply-management.edu"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    required
                  />
                </div>
                {errors.email ? <p className="mt-2 text-xs font-semibold text-rose-600">{errors.email}</p> : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Password</label>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 transition-colors group-focus-within:text-primary-500">
                      <LockClosedIcon className="h-5 w-5" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Minimum 8 characters"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-12 text-sm text-slate-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition-colors hover:text-slate-600"
                    >
                      {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password ? <p className="mt-2 text-xs font-semibold text-rose-600">{errors.password}</p> : null}
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Confirm Password
                  </label>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 transition-colors group-focus-within:text-primary-500">
                      <LockClosedIcon className="h-5 w-5" />
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Repeat password"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-12 text-sm text-slate-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((current) => !current)}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition-colors hover:text-slate-600"
                    >
                      {showConfirmPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.confirmPassword ? (
                    <p className="mt-2 text-xs font-semibold text-rose-600">{errors.confirmPassword}</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-primary-100 bg-primary-50/70 px-4 py-3 text-sm leading-6 text-slate-600">
                The new record will be saved with the fixed role <span className="font-bold text-primary-700">Administrator</span>.
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-4 text-sm font-bold text-white shadow-xl shadow-primary-600/20 transition-all hover:-translate-y-0.5 hover:bg-primary-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {isSubmitting ? "Creating Administrator..." : "Create Administrator Account"}
                {!isSubmitting ? <ArrowRightIcon className="h-4 w-4" /> : null}
              </button>
            </form>

            <div className="mt-8 text-center text-sm font-medium text-slate-500">
              Ready to use the new account?{" "}
              <Link to="/auth/login" className="font-bold text-primary-600 hover:underline">
                Sign in here
              </Link>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
