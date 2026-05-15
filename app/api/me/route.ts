export async function GET() {
  const userId = process.env.DEV_USER_ID ?? null
  return Response.json({ userId })
}
