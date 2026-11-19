import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/lokasi/expand/route";

function req(url: unknown, ip = "1.1.1.1") {
  return new Request("https://istanablock.com/api/lokasi/expand", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": ip },
    body: JSON.stringify({ url }),
  });
}
const redirect = (to: string) => new Response(null, { status: 302, headers: { location: to } });

afterEach(() => vi.unstubAllGlobals());

describe("POST /api/lokasi/expand", () => {
  it("mengikuti redirect dan mengembalikan hanya {lat,lng}", async () => {
    const fetchMock = vi.fn(async () => redirect("https://www.google.com/maps/place/X/@-6.5569,107.4433,17z"));
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req("https://maps.app.goo.gl/AbC", "10.0.0.1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ lat: -6.5569, lng: 107.4433 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown[])[1]).toMatchObject({ redirect: "manual" });
  });

  it("menolak URL bukan tautan pendek tanpa memanggil jaringan", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const u of ["https://evil.com/x", "http://maps.app.goo.gl/x", "https://www.google.com/maps/@1,2,3z", "https://169.254.169.254/", 123, ""]) {
      const res = await POST(req(u, "10.0.0.2"));
      expect(res.status, String(u)).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("memutus bila hop redirect keluar dari daftar host", async () => {
    const fetchMock = vi.fn(async () => redirect("http://169.254.169.254/latest/meta-data/"));
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req("https://maps.app.goo.gl/AbC", "10.0.0.3"));
    expect(res.status).toBe(422);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(Object.keys(body as object)).toEqual(["error"]);
  });

  it("membatasi jumlah redirect (maks 5 hop setelah permintaan awal)", async () => {
    const fetchMock = vi.fn(async () => redirect("https://www.google.com/maps/dir/aa"));
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req("https://maps.app.goo.gl/AbC", "10.0.0.4"));
    expect(res.status).toBe(422);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it("tidak membocorkan isi halaman bila koordinat tidak ada", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>RAHASIA</html>", { status: 200 })));
    const res = await POST(req("https://maps.app.goo.gl/AbC", "10.0.0.5"));
    expect(res.status).toBe(422);
    expect(JSON.stringify(await res.json())).not.toContain("RAHASIA");
  });

  it("membatasi laju per IP", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => redirect("https://www.google.com/maps/@1,2,3z")));
    let terakhir = 200;
    for (let i = 0; i < 14; i++) terakhir = (await POST(req("https://maps.app.goo.gl/AbC", "10.9.9.9"))).status;
    expect(terakhir).toBe(429);
  });
});
