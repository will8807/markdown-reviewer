-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('LOCAL', 'GIT');

-- CreateEnum
CREATE TYPE "AnchorType" AS ENUM ('TEXT_SELECTION', 'HEADING', 'BLOCK', 'IMAGE_REGION', 'DIFF_HUNK');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "name" TEXT NOT NULL,
    "localPath" TEXT,
    "gitUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceRevision" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sha" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SourceRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileEntry" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FileEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FileEntry_sourceId_path_key" ON "FileEntry"("sourceId", "path");

-- CreateTable
CREATE TABLE "ReviewSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentThread" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "fileId" TEXT,
    "sessionId" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommentThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentAnchor" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "revisionId" TEXT,
    "type" "AnchorType" NOT NULL,
    "filePath" TEXT NOT NULL,
    "selectedText" TEXT,
    "prefix" TEXT,
    "suffix" TEXT,
    "headingPath" TEXT,
    "charStart" INTEGER,
    "charEnd" INTEGER,
    "imgX" DOUBLE PRECISION,
    "imgY" DOUBLE PRECISION,
    "imgW" DOUBLE PRECISION,
    "imgH" DOUBLE PRECISION,
    "diffSide" TEXT,
    "hunkId" TEXT,
    "lineStart" INTEGER,
    "lineEnd" INTEGER,
    CONSTRAINT "CommentAnchor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommentAnchor_threadId_key" ON "CommentAnchor"("threadId");

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SourceRevision" ADD CONSTRAINT "SourceRevision_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FileEntry" ADD CONSTRAINT "FileEntry_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReviewSession" ADD CONSTRAINT "ReviewSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CommentThread" ADD CONSTRAINT "CommentThread_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CommentThread" ADD CONSTRAINT "CommentThread_fileId_fkey"
    FOREIGN KEY ("fileId") REFERENCES "FileEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommentThread" ADD CONSTRAINT "CommentThread_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "ReviewSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Comment" ADD CONSTRAINT "Comment_threadId_fkey"
    FOREIGN KEY ("threadId") REFERENCES "CommentThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CommentAnchor" ADD CONSTRAINT "CommentAnchor_threadId_fkey"
    FOREIGN KEY ("threadId") REFERENCES "CommentThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommentAnchor" ADD CONSTRAINT "CommentAnchor_revisionId_fkey"
    FOREIGN KEY ("revisionId") REFERENCES "SourceRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
