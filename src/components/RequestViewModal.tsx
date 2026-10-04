import { XCircleIcon } from "@heroicons/react/24/outline";
import type { FacultyRequest } from "../types/requests";
import RequestViewContent from "./RequestViewContent";

type RequestViewModalProps = {
  request: FacultyRequest;
  open: boolean;
  onClose: () => void;
};

export default function RequestViewModal({
  request,
  open,
  onClose,
}: RequestViewModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-950/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-[210mm] max-h-[calc(100vh_-_3rem)] overflow-y-auto rounded-[1.75rem] border border-brown-200 bg-white shadow-sm" onClick={(e) => e.stopPropagation()}>
        <button onClick={(e) => {
            e.stopPropagation();
            onClose();
          }} className="absolute top-2 right-2 rounded-xl p-2 text-brown-700 hover:text-brown-900 hover:bg-brown-50 transition" aria-label="Close">
          <XCircleIcon className="h-5 w-5" />
        </button>
        <RequestViewContent request={request} />
      </div>
    </div>
  );
}
