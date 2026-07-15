import { useEffect } from "react"
import { useNavigate } from "react-router-dom"

export default function ApprovalPersonnel() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate("/approval-personnel", { replace: true })
  }, [navigate])

  return null
}
