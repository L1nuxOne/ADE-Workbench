import { hostRun } from "./host";

export type PR = {
  number: number;
  title: string;
  headRefName: string;
  headRepositoryOwner?: { login: string };
};

export async function listOpenPRs(): Promise<PR[]> {
  const args = [
    "pr","list",
    "--state","open",
    "--json","number,title,headRefName,headRepositoryOwner",
    "--limit","100"
  ];
  const res = await hostRun("gh", args, /*dryRun*/ false);
  if (res.status !== 0) throw new Error(res.stderr || "gh pr list failed");
  try {
    const data = JSON.parse(res.stdout) as PR[];
    return Array.isArray(data) ? data : [];
  } catch (e) {
    throw new Error("failed to parse gh output");
  }
}
