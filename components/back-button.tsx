"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface BackButtonParams {
  className?: string;
}

export default function BackButton({ className }: BackButtonParams) {
  const router = useRouter();
  return (
    <>
      <button
        onClick={() => router.back()}
        className={`inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out ${className}`}
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        Back
      </button>
    </>
  );
}
