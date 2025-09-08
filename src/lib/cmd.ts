export function parseCommand(cmd: string): string[] {
  const parts: string[] = [];
  const re = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cmd))) parts.push(m[1] ?? m[2] ?? m[0]);
  return parts;
}
