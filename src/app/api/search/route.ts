import { NextResponse } from "next/server";
import { getSearchIndex } from "@/lib/search-index";

export async function GET() {
  try {
    const items = await getSearchIndex();
    return NextResponse.json(
      { items },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (err) {
    console.error("[/api/search] gagal memuat indeks:", err);
    return NextResponse.json(
      { error: "Gagal memuat indeks pencarian." },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
