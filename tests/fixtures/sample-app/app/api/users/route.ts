import { getSessionSecret } from "../../../lib/auth";

export async function GET() {
  const ok = Boolean(getSessionSecret());
  return Response.json({ users: ok ? ["alice", "bob"] : [] });
}
