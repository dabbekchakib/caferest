"use client";

export {
  useAuthContext,
  type AuthContextValue,
} from "@/components/providers/auth-context";

import { useAuthContext } from "@/components/providers/auth-context";

export function useAuth() {
  return useAuthContext();
}
