import { motion } from "framer-motion";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function LoadingSpinner({ size = "md", className = "" }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12"
  };

  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: "linear"
      }}
      className={`${sizeClasses[size]} ${className}`}
    >
      <div className="relative w-full h-full">
        <div className="absolute inset-0 rounded-full border-2 border-primary-200" />
        <div className="absolute inset-0 rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    </motion.div>
  );
}