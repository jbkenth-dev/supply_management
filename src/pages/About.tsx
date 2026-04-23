import { ClipboardDocumentListIcon, MegaphoneIcon, ShieldCheckIcon, Squares2X2Icon } from "@heroicons/react/24/outline"
import { FadeIn } from "../components/ui/animations"

const systemHighlights = [
  {
    title: "Public Supply Catalog",
    description: "The system provides a public supplies page where users can browse database-backed categories and inventory items.",
    icon: Squares2X2Icon,
    tone: "bg-blue-50 text-blue-600",
  },
  {
    title: "Faculty Request Workflow",
    description: "Faculty staff can create supply requests, monitor request status, and cancel pending requests from their own account.",
    icon: ClipboardDocumentListIcon,
    tone: "bg-emerald-50 text-emerald-600",
  },
  {
    title: "Office Processing",
    description: "Administrators and property custodians can review requests, approve them, issue supplies, manage stock, and monitor inventory records.",
    icon: ShieldCheckIcon,
    tone: "bg-amber-50 text-amber-600",
  },
  {
    title: "Announcements and Updates",
    description: "Administrators can publish announcements that appear on the public home page, while notifications and messages support day-to-day coordination.",
    icon: MegaphoneIcon,
    tone: "bg-rose-50 text-rose-600",
  },
]

const objectives = [
  "Provide a centralized and accurate database record of categories, supplies, stock entries, and supply requests.",
  "Support separate workflows for Administrator, Property Custodian, and Faculty Staff users through role-based access.",
  "Improve request tracking by allowing submission, approval, issuance, fulfilment, cancellation, and status monitoring inside one system.",
  "Make stock information more reliable through inventory management pages, request issuance records, and dashboard summaries.",
  "Keep users informed through announcements, in-app notifications, and direct messaging tools built into the project.",
]

export default function About() {
  return (
    <div className="min-h-screen bg-slate-50/60 px-4 pb-20 pt-24">
      <div className="mx-auto max-w-6xl space-y-10">
        <FadeIn>
          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-600">About</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">System Description</h1>
            <p className="mt-5 max-w-4xl text-base leading-8 text-slate-600">
              SFC-G Supply Management is a web-based stocks and supply management system designed to organize supply monitoring,
              inventory control, request submission, request issuance, announcements, notifications, and role-based user access in a
              single project. The system currently supports public supply viewing, faculty request submission and tracking,
              administrator and property custodian inventory operations, direct messaging, and database-backed announcement publishing.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {systemHighlights.map((item) => (
                <div key={item.title} className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.tone}`}>
                    <item.icon className="h-6 w-6" />
                  </div>
                  <h2 className="mt-4 text-lg font-black tracking-tight text-slate-900">{item.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-500">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Project Goals</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">Mission and Objectives</h2>
            <p className="mt-5 max-w-4xl text-base leading-8 text-slate-600">
              The mission of this project is to improve how supplies are recorded, requested, processed, and communicated inside the
              institution by replacing scattered manual processes with a more consistent digital workflow. Its objectives focus on
              accurate records, clearer coordination between users, and better visibility into supply activity.
            </p>

            <div className="mt-8 space-y-4">
              {objectives.map((objective) => (
                <div key={objective} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-4">
                  <p className="text-sm leading-7 text-slate-600">{objective}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
