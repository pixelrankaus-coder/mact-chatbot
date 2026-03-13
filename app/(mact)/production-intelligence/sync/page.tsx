"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Redirect /production-intelligence/sync → /production-intelligence/settings
export default function SyncRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/production-intelligence/settings");
  }, [router]);
  return null;
}
