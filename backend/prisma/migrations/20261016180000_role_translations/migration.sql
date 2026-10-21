-- Job titles as job ads in other languages write them, so the matcher can search local-language ads.
CREATE TABLE "role_translations" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "role_translations_role_language_key" ON "role_translations"("role", "language");
