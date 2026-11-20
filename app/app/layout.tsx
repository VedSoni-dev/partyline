import type { Metadata } from "next";
import { Gate } from "@/components/Gate";

export const metadata: Metadata = { title: "Big screen" };

// Sign in with publik in front of the big screen (every studio build signs in through the builds hub). Phones at
// /join never sign in. Signed in, the big screen renders inside <StudioProvider> (components/Gate.tsx).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Gate>{children}</Gate>;
}
