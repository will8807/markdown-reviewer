import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getRepoDir } from "@/lib/sources/gitRevisions";
import { resolveRef, readFile, listRefs } from "@/lib/sources/gitSource";
import { listChangedFiles, computeFileDiff } from "@/lib/diff/computeDiff";
import { renderMarkdown } from "@/lib/markdown/render";
import { isMarkdownPath } from "@/lib/files/fileType";
import CompareClient from "@/components/CompareClient";
import type { DiffHunk } from "@/lib/diff/computeDiff";

interface ActiveFileDiff {
  baseHtml: string | null;
  headHtml: string | null;
  hunks: DiffHunk[];
  isBinary: boolean;
  isCode: boolean;
  status: "added" | "removed" | "modified" | "renamed";
}

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; sourceId: string }>;
  searchParams: Promise<{ base?: string; head?: string; path?: string }>;
}) {
  const { projectId, sourceId } = await params;
  const { base, head, path: activePath } = await searchParams;

  const source = await prisma.source.findFirst({
    where: { id: sourceId, projectId },
  });
  if (!source) notFound();

  if (source.type !== "GIT") {
    return (
      <div className="p-8 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Compare is available for Git sources
        </h1>
        <p className="mt-2">
          {source.name} is a local folder source, so it does not have refs to compare. Add a Git
          source to review changes between branches, tags, or commits.
        </p>
        <Link
          href={`/projects/${projectId}/sources/${sourceId}`}
          className="mt-4 inline-flex rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          Back to viewer
        </Link>
      </div>
    );
  }

  const repoDir = getRepoDir(source.id);

  // Clone/fetch and list refs server-side so dropdowns are pre-populated on
  // the first render — no client-side round-trip needed.
  if (source.gitUrl) {
    const { cloneOrFetch } = await import("@/lib/sources/gitSource");
    try {
      await cloneOrFetch(source.gitUrl, repoDir);
    } catch {
      /* non-fatal */
    }
  }
  const refs = await listRefs(repoDir).catch(() => []);

  if (!base || !head) {
    return (
      <CompareClient
        projectId={projectId}
        sourceId={sourceId}
        files={[]}
        baseSha={null}
        headSha={null}
        base={base ?? null}
        head={head ?? null}
        activePath={null}
        activeFileDiff={null}
        refs={refs}
      />
    );
  }

  // cloneOrFetch already done above

  let baseSha: string;
  let headSha: string;
  try {
    [baseSha, headSha] = await Promise.all([resolveRef(repoDir, base), resolveRef(repoDir, head)]);
  } catch {
    return <div className="p-8 text-red-500">Failed to resolve refs. Check that both exist.</div>;
  }

  const files = await listChangedFiles(repoDir, baseSha, headSha).catch(() => []);

  let activeFileDiff: ActiveFileDiff | null = null;

  if (activePath) {
    try {
      const diff = await computeFileDiff(repoDir, baseSha, headSha, activePath);
      const isCode = !isMarkdownPath(activePath);

      let baseHtml: string | null = null;
      let headHtml: string | null = null;

      if (!diff.isBinary && !isCode) {
        if (diff.status !== "added") {
          try {
            const buf = await readFile(repoDir, baseSha, activePath);
            baseHtml = await renderMarkdown(buf.toString("utf8"), {
              projectId,
              sourceId,
              filePath: activePath,
              includeSourceLines: true,
              ref: baseSha,
            });
          } catch {
            /* file may not exist on base */
          }
        }

        if (diff.status !== "removed") {
          try {
            const buf = await readFile(repoDir, headSha, activePath);
            headHtml = await renderMarkdown(buf.toString("utf8"), {
              projectId,
              sourceId,
              filePath: activePath,
              includeSourceLines: true,
              ref: headSha,
            });
          } catch {
            /* file may not exist on head */
          }
        }
      }

      activeFileDiff = {
        baseHtml,
        headHtml,
        hunks: diff.hunks,
        isBinary: diff.isBinary,
        isCode,
        status: diff.status,
      };
    } catch {
      /* diff failed — show nothing */
    }
  }

  return (
    <CompareClient
      projectId={projectId}
      sourceId={sourceId}
      files={files}
      baseSha={baseSha}
      headSha={headSha}
      base={base}
      head={head}
      activePath={activePath ?? null}
      activeFileDiff={activeFileDiff}
      refs={refs}
    />
  );
}
