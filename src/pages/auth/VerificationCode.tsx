import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ShieldCheckIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline"
import { api } from "../../lib/api"
import { getAccountStatusPath, setStoredAuthUser, type AuthUser, type AuthRole } from "../../lib/auth"
import { MessageModal } from "../../components/ui/MessageModal"

const CODE_LENGTH = 6
const EXPIRY_SECONDS = 5 * 60 // 5 minutes

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

export default function VerificationCode() {
  const navigate = useNavigate()
  const location = useLocation()
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const state = location.state as { pendingId?: number; userId?: number; email?: string; role?: AuthRole; signupFormData?: Record<string, string> } | null
  const pendingId = state?.pendingId ?? null
  const userId = state?.userId ?? null
  const regId = pendingId ?? userId
  const email = state?.email
  const signupFormData = state?.signupFormData ?? null

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""))
  const [error, setError] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  const [remainingSeconds, setRemainingSeconds] = useState(EXPIRY_SECONDS)
  const [isExpired, setIsExpired] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  // Redirect if no regId/email
  useEffect(() => {
    if (!regId || !email) {
      navigate("/auth/signup", { replace: true })
    }
  }, [regId, email, navigate])

  // Countdown timer
  useEffect(() => {
    if (remainingSeconds <= 0) {
      setIsExpired(true)
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
  }, [remainingSeconds])

  useEffect(() => {
    if (error) {
      setShowErrorModal(true)
    }
  }, [error])

  useEffect(() => {
    if (successMessage) {
      setShowSuccessModal(true)
    }
  }, [successMessage])

  const getFullCode = useCallback(() => {
    return digits.join("")
  }, [digits])

  const handleDigitChange = (index: number, value: string) => {
    // Only allow single digits
    if (value.length > 1) {
      value = value.slice(-1)
    }

    if (value !== "" && !/^\d$/.test(value)) {
      return
    }

    const newDigits = [...digits]
    newDigits[index] = value
    setDigits(newDigits)
    setError("")
    setSuccessMessage("")

    // Auto-focus next input
    if (value !== "" && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all digits are filled
    if (value !== "" && index === CODE_LENGTH - 1) {
      const fullCode = newDigits.join("")
      if (fullCode.length === CODE_LENGTH) {
        handleVerify(fullCode)
      }
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      if (digits[index] === "" && index > 0) {
        // Move to previous input and clear it
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
    setError("")
    setSuccessMessage("")

    // Focus the appropriate input
    const focusIndex = Math.min(pastedText.length, CODE_LENGTH - 1)
    inputRefs.current[focusIndex]?.focus()

    // Auto-submit if all digits pasted
    if (pastedText.length === CODE_LENGTH) {
      handleVerify(pastedText)
    }
  }

  const handleVerify = async (code?: string) => {
    const fullCode = code ?? getFullCode()

    if (fullCode.length !== CODE_LENGTH) {
      setError("Please enter all 6 digits.")
      return
    }

    if (isExpired) {
      setError("Verification code has expired. Please request a new one.")
      return
    }

    setIsVerifying(true)
    setError("")
    setSuccessMessage("")

    try {
      const response = await api("/api/verify-email.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingId: pendingId ?? undefined, userId: userId ?? undefined, code: fullCode }),
      })

      let result: any
      try {
        result = await response.json()
      } catch {
        setError("Server error. Please try again.")
        return
      }

      if (!response.ok) {
        setError(result.message ?? "Invalid verification code. Please try again.")
        // Clear the code inputs on error
        setDigits(Array(CODE_LENGTH).fill(""))
        inputRefs.current[0]?.focus()
        return
      }

      setSuccessMessage("Email verified successfully! Redirecting...")

      // If already verified, just use the user data from result
      if (result.alreadyVerified && result.user) {
        const user = result.user as AuthUser
        setStoredAuthUser(user)
        navigate(getAccountStatusPath(user.role), { replace: true })
        return
      }

      // Build user object from the verification result
      if (result.user) {
        const user = result.user as AuthUser
        setStoredAuthUser(user)
        setTimeout(() => {
          navigate(getAccountStatusPath(user.role), { replace: true })
        }, 1000)
      }
    } catch {
      setError("Unable to connect to the verification service. Please try again.")
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    setIsResending(true)
    setError("")
    setSuccessMessage("")

    try {
      const response = await api("/api/resend-verification.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingId: pendingId ?? undefined, userId: userId ?? undefined }),
      })

      let result: any
      try {
        result = await response.json()
      } catch {
        setError("Server error. Please try again.")
        return
      }

      if (!response.ok) {
        setError(result.message ?? "Unable to resend verification code.")
        return
      }

      // Send verification email via Vercel serverless function
      // (Awardspace blocks all outbound connections).
      if (result.code) {
        api("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: result.email ?? email,
            name: result.name ?? "",
            code: result.code,
            type: "resend",
          }),
        }).catch(() => {
          // Email failure is non-fatal — the code was regenerated
        })
      }

      // Reset the timer and code
      setRemainingSeconds(EXPIRY_SECONDS)
      setIsExpired(false)
      setDigits(Array(CODE_LENGTH).fill(""))
      setSuccessMessage("A new verification code has been sent to your email.")
      inputRefs.current[0]?.focus()
    } catch {
      setError("Unable to connect to the verification service. Please try again.")
    } finally {
      setIsResending(false)
    }
  }

  if (!regId || !email) {
    return null
  }

  return (
    <div className="auth-shell min-h-screen flex items-center justify-center p-6 sm:p-12">
      <div className="auth-grid" />
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <div className="auth-wave auth-wave-top" />
      <div className="auth-wave auth-wave-bottom" />

      <div className="auth-card w-full max-w-[480px] mx-4 sm:mx-0 rounded-[2.5rem] p-6 sm:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center">
              <ShieldCheckIcon className="w-8 h-8 text-primary-600" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-brown-900 mb-2">
              Verify Your Email
            </h2>
            <p className="text-brown-500 font-medium text-sm leading-relaxed">
              We sent a 6-digit verification code to
            </p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <EnvelopeIcon className="w-4 h-4 text-primary-500" />
              <span className="text-sm font-bold text-primary-600">{email}</span>
            </div>
          </div>

          {/* Messages */}
          <MessageModal
            open={showErrorModal}
            title="Verification Error"
            message={error}
            type="error"
            onClose={() => setShowErrorModal(false)}
          />

          <MessageModal
            open={showSuccessModal}
            title="Verification Success"
            message={successMessage}
            type="success"
            onClose={() => setShowSuccessModal(false)}
          />

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
          </div>

          {/* Timer */}
          <div className="mb-8 text-center">
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
            onClick={() => handleVerify()}
            disabled={isVerifying || getFullCode().length !== CODE_LENGTH || isExpired}
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
                  onClick={handleResend}
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

          {/* Change email */}
          <div className="mt-8 text-center">
            <p className="text-sm text-brown-500 font-medium">
              Wrong email?{" "}
              <Link
                to="/auth/signup"
                state={{ prefill: signupFormData ? { ...signupFormData, email: email ?? '' } : undefined }}
                className="text-primary-600 font-bold hover:underline"
              >
                Change Email
              </Link>
            </p>
          </div>

          {/* Back to signup */}
          <div className="mt-4 text-center">
            <Link
              to="/auth/signup"
              className="text-xs text-brown-400 font-medium hover:text-primary-600 transition-colors"
            >
              Back to Sign Up
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
