export async function purgeExpiredSessions(env: { SESSIONS: KVNamespace }) {
  const list = await env.SESSIONS.list();
  for (const key of list.keys) await env.SESSIONS.delete(key.name);
}

export async function handleMessage(msg: Message, env: unknown) {
  void msg;
  void env;
}
