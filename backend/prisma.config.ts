import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // The Prisma CLI (migrate, status, studio) needs a session connection:
    // it hangs through Supabase's transaction pooler (port 6543), which the app
    // itself uses via DATABASE_URL. DIRECT_URL is the session pooler (5432).
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});
