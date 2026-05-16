-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CommentThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "fileId" TEXT,
    "sessionId" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CommentThread_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommentThread_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CommentThread_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ReviewSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CommentThread" ("createdAt", "fileId", "id", "resolved", "resolvedAt", "sessionId", "sourceId", "updatedAt") SELECT "createdAt", "fileId", "id", "resolved", "resolvedAt", "sessionId", "sourceId", "updatedAt" FROM "CommentThread";
DROP TABLE "CommentThread";
ALTER TABLE "new_CommentThread" RENAME TO "CommentThread";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
