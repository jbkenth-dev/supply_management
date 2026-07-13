import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  EnvelopeIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  ShieldCheckIcon,
  KeyIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline"
import { api } from "../../lib/api"
import { MessageModal } from "../../components/ui/MessageModal"

/* ─── Constants ───────────────────────────────────────────── */

const CODE_LENGTH = 6
const CODE_EXPIRY_SECONDS = 10 * 60 // 10 minutes

/* ─── Helpers ─────────────────────────────────────────────── */

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

function passwordMeetsAllRequirements(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  )
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { score, label: "Weak", color: "bg-rose-500" }
  if (score <= 2) return { score, label: "Fair", color: "bg-orange-500" }
  if (score <= 3) return { score, label: "Good", color: "bg-amber-500" }
  if (score <= 4) return { score, label: "Strong", color: "bg-emerald-500" }
  return { score, label: "Very Strong", color: "bg-emerald-600" }
}

/* ─── Step Indicator ──────────────────────────────────────── */

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: "Email" },
    { num: 2, label: "Code" },
    { num: 3, label: "Password" },
  ]

  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((step, index) => {
        const isCompleted = currentStep > step.num
        const isActive = currentStep === step.num

        return (
          <div key={step.num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  isCompleted
                    ? "bg-primary-600 text-white"
                    : isActive
                    ? "bg-primary-600 text-white ring-4 ring-primary-100"
                    : "bg-brown-200 text-brown-400"
                }`}
              >
                {isCompleted ? (
                  <CheckCircleIcon className="w-5 h-5" />
                ) : (
                  step.num
                )}
              </div>
              <span
                className={`text-xs font-bold mt-2 transition-colors ${
                  isActive || isCompleted ? "text-primary-600" : "text-brown-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-12 sm:w-16 h-0.5 mx-2 -mt-5 rounded-full transition-colors duration-300 ${
                  currentStep > step.num ? "bg-primary-600" : "bg-brown-200"
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Main Component ──────────────────────────────────────── */

export default function ForgotPassword() {
  const navigate = useNavigate()

  // Wizard state
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1) // 1 = forward, -1 = backward

  // Step 1 state
  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState("")
  const [isRequesting, setIsRequesting] = useState(false)

  // Step 2 state
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""))
  const [codeError, setCodeError] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(CODE_EXPIRY_SECONDS)
  const [isExpired, setIsExpired] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Step 3 state
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [newPasswordError, setNewPasswordError] = useState("")
  const [confirmPasswordError, setConfirmPasswordError] = useState("")
  const [isResetting, setIsResetting] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)

  // Global
  const [serverMessage, setServerMessage] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState<"success" | "error">("error")

  const strength = getPasswordStrength(newPassword)

  // ─── Modal effect ────────────────────────────────────────

  useEffect(() => {
    if (serverMessage) {
      setShowModal(true)
    }
  }, [serverMessage])

  // ─── Step 2: Countdown timer ─────────────────────────────

  useEffect(() => {
    if (step !== 2 || remainingSeconds <= 0) {
      if (remainingSeconds <= 0) setIsExpired(true)
      return
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsExpired(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [step, remainingSeconds])

  // ─── Step Navigation ─────────────────────────────────────

  const goToStep = useCallback(
    (nextStep: number) => {
      setDirection(nextStep > step ? 1 : -1)
      setStep(nextStep)
    },
    [step]
  )

  // ─── Step 1: Request Code ────────────────────────────────

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError("")
    setServerMessage("")

    const trimmed = email.trim().toLowerCase()

    if (!trimmed) {
      setEmailError("Email is required.")
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Please enter a valid email address.")
      return
    }

    setIsRequesting(true)

    try {
      const response = await api("/api/forgot-password-request.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      })

      let result: any
      try {
        result = await response.json()
      } catch {
        setServerMessage("Server error. Please try again.")
        setModalType("error")
        return
      }

      if (!response.ok) {
        setEmailError(result.message ?? "Unable to process your request.")
        return
      }

      // Send password reset email via Vercel serverless function
      // (Awardspace blocks all outbound connections).
      if (result.code) {
        api("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: result.email ?? trimmed,
            name: result.name ?? "",
            code: result.code,
            type: "password-reset",
            expiryMinutes: 10,
          }),
        }).catch(() => {
          // Email failure is non-fatal — the code was saved on the server
        })
      }

      // Success — advance to step 2
      setRemainingSeconds(CODE_EXPIRY_SECONDS)
      setIsExpired(false)
      setDigits(Array(CODE_LENGTH).fill(""))
      goToStep(2)
    } catch {
      setServerMessage("Unable to connect to the server. Please try again later.")
      setModalType("error")
    } finally {
      setIsRequesting(false)
    }
  }

  // ─── Step 2: Code Input ──────────────────────────────────

  const handleDigitChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1)
    if (value !== "" && !/^\d$/.test(value)) return

    const newDigits = [...digits]
    newDigits[index] = value
    setDigits(newDigits)
    setCodeError("")

    if (value !== "" && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }

    if (value !== "" && index === CODE_LENGTH - 1) {
      const fullCode = newDigits.join("")
      if (fullCode.length === CODE_LENGTH) {
        handleVerifyCode(fullCode)
      }
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      if (digits[index] === "" && index > 0) {
        const newDigits = [...digits]
        newDigits[index - 1] = ""
        setDigits(newDigits)
        inputRefs.current[index - 1]?.focus()
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH)
    if (pastedText.length === 0) return

    const newDigits = [...digits]
    for (let i = 0; i < CODE_LENGTH; i++) {
      newDigits[i] = pastedText[i] ?? ""
    }
    setDigits(newDigits)
    setCodeError("")

    const focusIndex = Math.min(pastedText.length, CODE_LENGTH - 1)
    inputRefs.current[focusIndex]?.focus()

    if (pastedText.length === CODE_LENGTH) {
      handleVerifyCode(pastedText)
    }
  }

  const handleVerifyCode = async (code?: string) => {
    const fullCode = code ?? digits.join("")

    if (fullCode.length !== CODE_LENGTH) {
      setCodeError("Please enter all 6 digits.")
      return
    }

    if (isExpired) {
      setCodeError("Verification code has expired. Please request a new one.")
      return
    }

    setIsVerifying(true)
    setCodeError("")

    try {
      const response = await api("/api/forgot-password-verify.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: fullCode }),
      })

      let result: any
      try {
        result = await response.json()
      } catch {
        setCodeError("Server error. Please try again.")
        return
      }

      if (!response.ok) {
        setCodeError(result.message ?? "Invalid verification code. Please try again.")
        setDigits(Array(CODE_LENGTH).fill(""))
        inputRefs.current[0]?.focus()
        return
      }

      // Success — advance to step 3
      goToStep(3)
    } catch {
      setCodeError("Unable to connect to the server. Please try again.")
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResendCode = async () => {
    setIsResending(true)
    setCodeError("")

    try {
      const response = await api("/api/forgot-password-request.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      let result: any
      try {
        result = await response.json()
      } catch {
        setCodeError("Server error. Please try again.")
        return
      }

      if (!response.ok) {
        setCodeError(result.message ?? "Unable to resend code.")
        return
      }

      // Send password reset email via Vercel serverless function
      // (Awardspace blocks all outbound connections).
      if (result.code) {
        api("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: result.email ?? email.trim().toLowerCase(),
            name: result.name ?? "",
            code: result.code,
            type: "password-reset",
            expiryMinutes: 10,
          }),
        }).catch(() => {
          // Email failure is non-fatal — the code was regenerated on the server
        })
      }

      setRemainingSeconds(CODE_EXPIRY_SECONDS)
      setIsExpired(false)
      setDigits(Array(CODE_LENGTH).fill(""))
      setServerMessage("A new verification code has been sent to your email.")
      setModalType("success")
      inputRefs.current[0]?.focus()
    } catch {
      setCodeError("Unable to connect to the server. Please try again.")
    } finally {
      setIsResending(false)
    }
  }

  // ─── Step 3: Reset Password ──────────────────────────────

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setNewPasswordError("")
    setConfirmPasswordError("")
    setServerMessage("")

    let hasError = false

    if (!newPassword) {
      setNewPasswordError("Password is required.")
      hasError = true
    } else if (newPassword.length < 8) {
      setNewPasswordError("Password must be at least 8 characters.")
      hasError = true
    }

    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your password.")
      hasError = true
    } else if (newPassword !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match.")
      hasError = true
    }

    if (hasError) return

    setIsResetting(true)

    try {
      const response = await api("/api/forgot-password-reset.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: digits.join(""),
          password: newPassword,
        }),
      })

      let result: any
      try {
        result = await response.json()
      } catch {
        setServerMessage("Server error. Please try again.")
        setModalType("error")
        return
      }

      if (!response.ok) {
        setServerMessage(result.message ?? "Unable to reset password.")
        setModalType("error")
        return
      }

      // Success — show success modal
      setResetSuccess(true)
    } catch {
      setServerMessage("Unable to connect to the server. Please try again later.")
      setModalType("error")
    } finally {
      setIsResetting(false)
    }
  }

  // ─── Animation Variants ──────────────────────────────────

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 80 : -80,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -80 : 80,
      opacity: 0,
    }),
  }

  // ─── Render ──────────────────────────────────────────────

  return (
    <div className="auth-shell min-h-screen flex items-center justify-center p-6 sm:p-12">
      <div className="auth-grid" />
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <div className="auth-wave auth-wave-top" />
      <div className="auth-wave auth-wave-bottom" />

      <div className="auth-card w-full max-w-120 mx-4 sm:mx-0 rounded-[2.5rem] p-6 sm:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Step Indicator */}
          <StepIndicator currentStep={step} />

          {/* Error / Success Modal */}
          <MessageModal
            open={showModal}
            title={modalType === "success" ? "Success" : "Error"}
            message={serverMessage}
            type={modalType}
            onClose={() => setShowModal(false)}
          />

          {/* Password Reset Success Modal */}
          <AnimatePresence>
            {resetSuccess && (
              <motion.div
                className="fixed inset-0 z-[100] flex items-center justify-center bg-brown-950/55 p-4 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 18, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.96 }}
                  transition={{ duration: 0.22 }}
                  className="w-full max-w-md overflow-hidden rounded-[2rem] border border-brown-200 bg-white shadow-2xl"
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 text-white">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                        <CheckCircleIcon className="h-7 w-7" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-100">
                          Success
                        </p>
                        <h2 className="mt-2 text-xl font-black tracking-tight leading-tight">
                          Password Updated
                        </h2>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="rounded-2xl border border-emerald-200/20 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-600">
                      Password updated successfully. Please sign in with your new password.
                    </div>

                    <div className="mt-6 flex justify-end">
                      <button
                        type="button"
                        onClick={() => navigate("/auth/login", { replace: true })}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
                      >
                        Back to Login
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Animated Step Content */}
          <AnimatePresence mode="wait" custom={direction}>
            {/* ─── Step 1: Enter Email ──────────────────── */}
            {step === 1 && (
              <motion.div
                key="step1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <div className="mb-8 text-center">
                  <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center">
                    <EnvelopeIcon className="w-8 h-8 text-primary-600" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-brown-900 mb-2">
                    Forgot Password?
                  </h2>
                  <p className="text-brown-500 font-medium text-sm leading-relaxed">
                    Enter your registered email address and we'll send you a verification code to reset your password.
                  </p>
                </div>

                <form onSubmit={handleRequestCode} className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-brown-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-brown-400 group-focus-within:text-primary-500 transition-colors">
                        <EnvelopeIcon className="h-5 w-5" />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value)
                          setEmailError("")
                          setServerMessage("")
                        }}
                        className="w-full pl-11 pr-4 py-3.5 bg-brown-50 border border-brown-200 rounded-xl text-sm text-brown-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                        placeholder="Enter your email address"
                        autoComplete="email"
                        required
                        disabled={isRequesting}
                        autoFocus
                      />
                    </div>
                    {emailError && (
                      <p className="mt-2 text-xs font-semibold text-rose-600">{emailError}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isRequesting}
                    className="w-full bg-primary-600 text-white py-4 rounded-xl font-bold text-sm shadow-xl shadow-primary-600/20 hover:bg-primary-700 hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                  >
                    {isRequesting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending Code...
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRightIcon className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-8 text-center">
                  <Link
                    to="/auth/login"
                    className="inline-flex items-center gap-1 text-sm text-brown-500 font-medium hover:text-primary-600 transition-colors"
                  >
                    <ArrowLeftIcon className="w-3.5 h-3.5" />
                    Back to Sign In
                  </Link>
                </div>
              </motion.div>
            )}

            {/* ─── Step 2: Enter Code ──────────────────── */}
            {step === 2 && (
              <motion.div
                key="step2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <div className="mb-8 text-center">
                  <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center">
                    <ShieldCheckIcon className="w-8 h-8 text-primary-600" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-brown-900 mb-2">
                    Enter Verification Code
                  </h2>
                  <p className="text-brown-500 font-medium text-sm leading-relaxed">
                    We sent a 6-digit code to
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <EnvelopeIcon className="w-4 h-4 text-primary-500" />
                    <span className="text-sm font-bold text-primary-600">{email}</span>
                  </div>
                </div>

                {/* Code Input */}
                <div className="mb-6">
                  <div className="flex justify-center gap-3">
                    {digits.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => { inputRefs.current[index] = el }}
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleDigitChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onPaste={handlePaste}
                        disabled={isVerifying || isExpired}
                        className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-black rounded-xl border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
                          digit
                            ? "border-primary-500 bg-primary-50 text-primary-700"
                            : "border-brown-200 bg-brown-50 text-brown-900"
                        } ${isVerifying ? "opacity-60" : ""} ${
                          isExpired ? "border-rose-300 bg-rose-50" : ""
                        }`}
                      />
                    ))}
                  </div>
                  {codeError && (
                    <p className="mt-3 text-xs font-semibold text-rose-600 text-center">{codeError}</p>
                  )}
                </div>

                {/* Timer */}
                <div className="mb-6 text-center">
                  {isExpired ? (
                    <p className="text-sm font-bold text-rose-600">
                      Code expired. Please request a new one.
                    </p>
                  ) : (
                    <p className="text-sm text-brown-500">
                      Code expires in{" "}
                      <span
                        className={`font-bold tabular-nums ${
                          remainingSeconds <= 60 ? "text-rose-600" : "text-primary-600"
                        }`}
                      >
                        {formatCountdown(remainingSeconds)}
                      </span>
                    </p>
                  )}
                </div>

                {/* Verify Button */}
                <button
                  onClick={() => handleVerifyCode()}
                  disabled={isVerifying || digits.join("").length !== CODE_LENGTH || isExpired}
                  className="w-full bg-primary-600 text-white py-4 rounded-xl font-bold text-sm shadow-xl shadow-primary-600/20 hover:bg-primary-700 hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                >
                  {isVerifying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify Code
                      <ArrowRightIcon className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Resend */}
                <div className="mt-6 text-center">
                  <p className="text-sm text-brown-500 font-medium">
                    Didn't receive the code?{" "}
                    {isExpired ? (
                      <button
                        onClick={handleResendCode}
                        disabled={isResending}
                        className="text-primary-600 font-bold hover:underline disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                      >
                        {isResending ? (
                          <>
                            <div className="w-3 h-3 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <ArrowPathIcon className="w-3.5 h-3.5" />
                            Resend Code
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-brown-400">
                        Resend available in {formatCountdown(remainingSeconds)}
                      </span>
                    )}
                  </p>
                </div>

                {/* Change email / Back */}
                <div className="mt-6 text-center space-y-2">
                  <button
                    onClick={() => goToStep(1)}
                    className="text-sm text-brown-500 font-medium hover:text-primary-600 transition-colors inline-flex items-center gap-1"
                  >
                    <ArrowLeftIcon className="w-3.5 h-3.5" />
                    Change Email
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─── Step 3: New Password ─────────────────── */}
            {step === 3 && (
              <motion.div
                key="step3"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <div className="mb-8 text-center">
                  <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center">
                    <KeyIcon className="w-8 h-8 text-primary-600" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-brown-900 mb-2">
                    Create New Password
                  </h2>
                  <p className="text-brown-500 font-medium text-sm leading-relaxed">
                    Your identity has been verified. Please create a new secure password.
                  </p>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-5">
                  {/* New Password */}
                  <div>
                    <label className="block text-sm font-bold text-brown-700 mb-2">
                      New Password
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-brown-400 group-focus-within:text-primary-500 transition-colors">
                        <LockClosedIcon className="h-5 w-5" />
                      </div>
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value)
                          setNewPasswordError("")
                          setServerMessage("")
                        }}
                        className="w-full pl-11 pr-12 py-3.5 bg-brown-50 border border-brown-200 rounded-xl text-sm text-brown-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                        placeholder="Enter new password"
                        autoComplete="new-password"
                        required
                        disabled={isResetting}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-brown-400 hover:text-brown-600 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isResetting}
                        tabIndex={-1}
                      >
                        {showNewPassword ? (
                          <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    {newPasswordError && (
                      <p className="mt-2 text-xs font-semibold text-rose-600">{newPasswordError}</p>
                    )}

                    {/* Password Strength Indicator */}
                    {newPassword && (
                      <div className="mt-3">
                        <div className="flex gap-1.5 mb-1.5">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <div
                              key={level}
                              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                level <= strength.score ? strength.color : "bg-brown-200"
                              }`}
                            />
                          ))}
                        </div>
                        <p
                          className={`text-xs font-bold ${
                            strength.score <= 1
                              ? "text-rose-600"
                              : strength.score <= 2
                              ? "text-orange-600"
                              : strength.score <= 3
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {strength.label}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-bold text-brown-700 mb-2">
                      Confirm New Password
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-brown-400 group-focus-within:text-primary-500 transition-colors">
                        <LockClosedIcon className="h-5 w-5" />
                      </div>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value)
                          setConfirmPasswordError("")
                          setServerMessage("")
                        }}
                        className="w-full pl-11 pr-12 py-3.5 bg-brown-50 border border-brown-200 rounded-xl text-sm text-brown-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                        placeholder="Confirm new password"
                        autoComplete="new-password"
                        required
                        disabled={isResetting}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-brown-400 hover:text-brown-600 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isResetting}
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? (
                          <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    {confirmPasswordError && (
                      <p className="mt-2 text-xs font-semibold text-rose-600">{confirmPasswordError}</p>
                    )}
                    {confirmPassword && newPassword === confirmPassword && !confirmPasswordError && (
                      <p className="mt-2 text-xs font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircleIcon className="w-3.5 h-3.5" />
                        Passwords match
                      </p>
                    )}
                  </div>

                  {/* Password Requirements */}
                  <div className="rounded-xl bg-brown-50 border border-brown-200 p-4">
                    <p className="text-xs font-bold text-brown-700 mb-2">Password must contain:</p>
                    <ul className="space-y-1">
                      {[
                        { met: newPassword.length >= 8, text: "At least 8 characters" },
                        { met: /[A-Z]/.test(newPassword), text: "One uppercase letter" },
                        { met: /[a-z]/.test(newPassword), text: "One lowercase letter" },
                        { met: /[0-9]/.test(newPassword), text: "One number" },
                        { met: /[^A-Za-z0-9]/.test(newPassword), text: "One special character" },
                      ].map((req) => (
                        <li
                          key={req.text}
                          className={`text-xs flex items-center gap-2 ${
                            req.met ? "text-emerald-600 font-medium" : "text-brown-400"
                          }`}
                        >
                          <CheckCircleIcon
                            className={`w-3.5 h-3.5 ${req.met ? "text-emerald-500" : "text-brown-300"}`}
                          />
                          {req.text}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="submit"
                    disabled={isResetting || !passwordMeetsAllRequirements(newPassword) || newPassword !== confirmPassword}
                    className="w-full bg-primary-600 text-white py-4 rounded-xl font-bold text-sm shadow-xl shadow-primary-600/20 hover:bg-primary-700 hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                  >
                    {isResetting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Resetting Password...
                      </>
                    ) : (
                      <>
                        Reset Password
                        <ArrowRightIcon className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    onClick={() => goToStep(2)}
                    className="text-sm text-brown-500 font-medium hover:text-primary-600 transition-colors inline-flex items-center gap-1"
                  >
                    <ArrowLeftIcon className="w-3.5 h-3.5" />
                    Back to Code Entry
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
