-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "account_daily_metrics" (
    "id" UUID NOT NULL,
    "socialAccountId" UUID NOT NULL,
    "metricDate" DATE NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_total_snapshots" (
    "id" UUID NOT NULL,
    "socialAccountId" UUID NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_total_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" UUID NOT NULL,
    "socialAccountId" UUID NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "rangeStart" DATE NOT NULL,
    "rangeEnd" DATE NOT NULL,
    "rowsWritten" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_daily_metrics_socialAccountId_metricDate_idx" ON "account_daily_metrics"("socialAccountId", "metricDate");

-- CreateIndex
CREATE UNIQUE INDEX "account_daily_metrics_socialAccountId_metricDate_metric_key" ON "account_daily_metrics"("socialAccountId", "metricDate", "metric");

-- CreateIndex
CREATE UNIQUE INDEX "account_total_snapshots_socialAccountId_snapshotDate_metric_key" ON "account_total_snapshots"("socialAccountId", "snapshotDate", "metric");

-- CreateIndex
CREATE INDEX "sync_runs_socialAccountId_startedAt_idx" ON "sync_runs"("socialAccountId", "startedAt" DESC);

-- AddForeignKey
ALTER TABLE "account_daily_metrics" ADD CONSTRAINT "account_daily_metrics_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_total_snapshots" ADD CONSTRAINT "account_total_snapshots_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
