import { useNavigate } from "react-router-dom"

export default function ForgotPassword() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-xl font-semibold text-gray-900">Reset password</h2>
        <p className="mb-6 text-sm text-gray-600">Enter your email to receive reset instructions</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            navigate("/login")
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" required className="mt-1 block w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500" />
          </div>
          <button type="submit" className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            Send reset link
          </button>
        </form>
      </div>
    </div>
  )
}
