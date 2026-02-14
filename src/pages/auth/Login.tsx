import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import ReCAPTCHA from "react-google-recaptcha"
import { motion } from "framer-motion"
import {
  EnvelopeIcon,
  LockClosedIcon,
  UserIcon,
  EyeIcon,
  EyeSlashIcon
} from "@heroicons/react/24/outline"
export default function Login() {
  const navigate = useNavigate()
  const [role, setRole] = useState<"Admin" | "Manager" | "Staff">("Manager")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{email?: string; password?: string}>({})

  const validateForm = () => {
    const newErrors: {email?: string; password?: string} = {}

    if (!email) {
      newErrors.email = "Email is required"
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email"
    }

    if (!password) {
      newErrors.password = "Password is required"
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return
    if (!captcha) return

    setIsLoading(true)

    // Simulate login process
    setTimeout(() => {
      setIsLoading(false)
      navigate("/dashboard", { state: { role } })
    }, 2000)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 sm:p-12">
      <div className="w-full max-w-[440px] bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/60 p-8 sm:p-12 border border-slate-100">
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
          <div className="mb-10">
            <h2 className="text-3xl font-black text-slate-900 mb-3">Sign In</h2>
            <p className="text-slate-500">Welcome back! Please enter your details.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary-500 transition-colors">
                    <EnvelopeIcon className="h-5 w-5" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    placeholder="name@company.com"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-slate-700">Password</label>
                  <Link to="/forgot-password" className="text-xs font-bold text-primary-600 hover:text-primary-700">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary-500 transition-colors">
                    <LockClosedIcon className="h-5 w-5" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Role Access</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary-500 transition-colors">
                    <UserIcon className="h-5 w-5" />
                  </div>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all appearance-none"
                  >
                    <option value="Admin">Administrator</option>
                    <option value="Manager">Manager</option>
                    <option value="Staff">Staff Member</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-slate-300 rounded cursor-pointer"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-600 cursor-pointer select-none">
                Keep me signed in
              </label>
            </div>

            <div className="py-2 flex justify-center">
              <ReCAPTCHA
                sitekey="6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
                onChange={setCaptcha}
                className="transform scale-[0.85] origin-center"
              />
            </div>

            <button
              type="submit"
              disabled={!captcha || isLoading}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-sm shadow-xl shadow-slate-900/10 hover:bg-slate-800 hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : (
                "Sign in to Dashboard"
              )}
            </button>
          </form>

          <div className="mt-10 text-center">
            <p className="text-sm text-slate-500 font-medium">
              Don't have an account?{" "}
              <Link to="/auth/signup" className="text-primary-600 font-bold hover:underline">
                Create Account
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
