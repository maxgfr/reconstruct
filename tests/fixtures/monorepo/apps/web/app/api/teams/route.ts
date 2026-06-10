export async function GET() {
  return Response.json({ teams: [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  return Response.json({ created: body }, { status: 201 });
}
