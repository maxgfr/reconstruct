export async function GET() {
  return Response.json({ users: [] });
}
export async function POST(req: Request) {
  return Response.json(await req.json(), { status: 201 });
}
