import React from "react";
import { HostClient, HostStatus } from "./hostClient";

const Ctx = React.createContext<{ client: HostClient; status: HostStatus; retry: () => Promise<void>; } | null>(null);

export function HostProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => new HostClient());
  const [status, setStatus] = React.useState<HostStatus>("down");
  React.useEffect(() => { client.discover().then(setStatus); }, [client]);
  async function retry() { setStatus(await client.discover()); }
  return <Ctx.Provider value={{ client, status, retry }}>{children}</Ctx.Provider>;
}

export function useHost() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("HostProvider missing");
  return v;
}
