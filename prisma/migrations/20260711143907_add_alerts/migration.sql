-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nodeId" TEXT,
    "metric" TEXT NOT NULL,
    "operator" TEXT NOT NULL DEFAULT 'gt',
    "threshold" REAL NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "webhookUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "nodeId" TEXT,
    "nodeName" TEXT,
    "metric" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "threshold" REAL NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlertEvent_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AlertRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AlertRule_enabled_idx" ON "AlertRule"("enabled");

-- CreateIndex
CREATE INDEX "AlertEvent_ruleId_idx" ON "AlertEvent"("ruleId");

-- CreateIndex
CREATE INDEX "AlertEvent_createdAt_idx" ON "AlertEvent"("createdAt");
