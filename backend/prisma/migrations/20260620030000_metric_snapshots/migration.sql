-- CreateTable: daily admin metric snapshots
CREATE TABLE "metric_snapshots" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "captured_on" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "metric_snapshots_key_captured_on_idx" ON "metric_snapshots"("key", "captured_on");

-- CreateIndex
CREATE UNIQUE INDEX "metric_snapshots_key_captured_on_key" ON "metric_snapshots"("key", "captured_on");
