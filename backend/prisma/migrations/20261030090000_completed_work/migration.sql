-- Work done through Coral: a marketplace request both sides confirmed as
-- finished, shown on the provider's profile.
CREATE TABLE "completed_work" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "proposed_by_id" TEXT NOT NULL,
    "proposed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "shown_by_provider" BOOLEAN NOT NULL DEFAULT true,
    "client_named" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "completed_work_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "completed_work_request_id_key" ON "completed_work"("request_id");
CREATE INDEX "completed_work_provider_id_confirmed_at_idx" ON "completed_work"("provider_id", "confirmed_at");

ALTER TABLE "completed_work" ADD CONSTRAINT "completed_work_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "marketplace_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "completed_work" ADD CONSTRAINT "completed_work_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "completed_work" ADD CONSTRAINT "completed_work_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
