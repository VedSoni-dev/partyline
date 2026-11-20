// One file says what this build is and which AI modes it offers. The kit reads it everywhere.
import type { StudioConfig } from "@/kit/ai/types";

const config: StudioConfig = {
  app: {
    name: "Partyline",
    slug: "partyline",
    version: "0.1.0",
    tagline: "Party games on one laptop, friends join from their phones",
    repo: "https://github.com/VedSoni-dev/partyline",
    url: "https://partyline.vedantsoni.com",
    alternativeTo: "Jackbox",
  },
  // Pick the modes that make sense for this build (docs/auth.md). Order = order in the picker. The hosted picker hides ChatGPT plan (local runs only).
  modes: ["claude","publik","chatgpt","local"],
  defaultMode: "claude",
};

export default config;
