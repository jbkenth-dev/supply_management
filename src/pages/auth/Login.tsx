import { useEffect, useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import ReCAPTCHA from "react-google-recaptcha"
import { motion } from "framer-motion"
import {
  EnvelopeIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon
} from "@heroicons/react/24/outline"
import { getDashboardPath, getStoredAuthUser, setStoredAuthUser, type AuthUser } from "../../lib/auth"

const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim() ?? ""
const shouldUseRecaptcha = Boolean(recaptchaSiteKey)

type LoginErrors = {
  identifier?: string
  password?: string
}

const formatCountdown = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

export default function Login() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<LoginErrors>({})
  const [serverMessage, setServerMessage] = useState("")
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)
  const [lockoutSeconds, setLockoutSeconds] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const isLocked = lockoutSeconds > 0

  useEffect(() => {
    const storedUser = getStoredAuthUser()

    if (!storedUser) {
      return
    }

    navigate(getDashboardPath(storedUser.role), { replace: true })
  }, [navigate])

  useEffect(() => {
    if (lockoutSeconds <= 0) {
      return
    }

    const timer = window.setInterval(() => {
      setLockoutSeconds((currentSeconds) => (currentSeconds > 0 ? currentSeconds - 1 : 0))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [lockoutSeconds])

  const validateForm = () => {
    const newErrors: LoginErrors = {}

    if (!identifier.trim()) {
      newErrors.identifier = "Email or username is required"
    }

    if (!password) {
      newErrors.password = "Password is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setServerMessage("")

    if (!validateForm()) return
    if (shouldUseRecaptcha && !captcha) return
    if (isLocked) return

    setIsLoading(true)

    try {
      const response = await fetch("/api/login.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          identifier,
          password
        })
      })

      const result = await response.json()

      if (!response.ok) {
        setErrors(result.errors ?? {})
        setServerMessage(result.message ?? "Unable to log in.")
        setAttemptsRemaining(typeof result.attemptsRemaining === "number" ? result.attemptsRemaining : null)
        setLockoutSeconds(typeof result.retryAfterSeconds === "number" ? result.retryAfterSeconds : 0)
        return
      }

      const user = result.user as AuthUser

      setErrors({})
      setAttemptsRemaining(null)
      setLockoutSeconds(0)
      setStoredAuthUser(user)
      const destination = getDashboardPath(user.role)

      navigate(destination, {
        replace: true,
        state: {
          role: user.role,
          user
        }
      })
    } catch {
      setServerMessage("Unable to connect to the PHP login service. Make sure Apache and MySQL are running in XAMPP.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-shell min-h-screen flex items-center justify-center p-6 sm:p-12">
      <div className="auth-grid" />
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <div className="auth-wave auth-wave-top" />
      <div className="auth-wave auth-wave-bottom" />

      <div className="auth-card w-full max-w-[440px] rounded-[2.5rem] p-8 sm:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-10">
            <h2 className="text-3xl font-black text-slate-900 mb-3">Sign In</h2>
            <p className="text-slate-500">Welcome back! Please enter your details.</p>
          </div>

          {serverMessage ? (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              <p>{serverMessage}</p>
              {attemptsRemaining !== null && attemptsRemaining > 0 ? (
                <p className="mt-1 text-xs font-semibold text-rose-600">
                  Attempts remaining: {attemptsRemaining} of 5
                </p>
              ) : null}
              {isLocked ? (
                <p className="mt-1 text-xs font-semibold text-rose-600">
                  Try again in {formatCountdown(lockoutSeconds)}.
                </p>
              ) : null}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Email or Username</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary-500 transition-colors">
                    <EnvelopeIcon className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value)
                      setErrors((currentErrors) => ({ ...currentErrors, identifier: undefined }))
                      setServerMessage("")
                      setAttemptsRemaining(null)
                    }}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    placeholder="Enter your email or username"
                    required
                    disabled={isLoading || isLocked}
                  />
                </div>
                {errors.identifier ? (
                  <p className="mt-2 text-xs font-semibold text-rose-600">{errors.identifier}</p>
                ) : null}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-slate-700">Password</label>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary-500 transition-colors">
                    <LockClosedIcon className="h-5 w-5" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setErrors((currentErrors) => ({ ...currentErrors, password: undefined }))
                      setServerMessage("")
                    }}
                    className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    placeholder="Enter your password"
                    required
                    disabled={isLoading || isLocked}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isLoading || isLocked}
                  >
                    {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password ? (
                  <p className="mt-2 text-xs font-semibold text-rose-600">{errors.password}</p>
                ) : null}
              </div>
            </div>

            {shouldUseRecaptcha ? (
              <div className="py-2 flex justify-center">
                <ReCAPTCHA
                  sitekey={recaptchaSiteKey}
                  onChange={setCaptcha}
                  className="transform scale-[0.85] origin-center"
                />
              </div>
            ) : null}

            <button
              type="submit"
              disabled={(shouldUseRecaptcha && !captcha) || isLoading || isLocked}
              className="w-full bg-primary-600 text-white py-4 rounded-xl font-bold text-sm shadow-xl shadow-primary-600/20 hover:bg-primary-700 hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : isLocked ? (
                `Try again in ${formatCountdown(lockoutSeconds)}`
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
