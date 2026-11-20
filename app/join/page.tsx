import type { Metadata } from "next";
import { Phone } from "@/components/Phone";

export const metadata: Metadata = { title: "Join a game" };

// Phones join here. No sign-in and no AI on the phone: the big screen does both.
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return <Phone initialCode={typeof code === "string" ? code : ""} />;
}
