-- Key-value store for admin-adjustable system settings (e.g. audit-log retention window).
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);
