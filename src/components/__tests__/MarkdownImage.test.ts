import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/components/Markdown";

// Regresi #418: <dialog> di dalam <p> membuat parser HTML memecah paragraf, sehingga HTML server
// tidak sama dengan pohon React di klien.
describe("Markdown dengan gambar inline", () => {
  it("tidak menaruh <dialog> di HTML server", () => {
    const html = renderToStaticMarkup(createElement(Markdown, null, "Contoh foto: ![Foto](/img/a.webp) dan teks."));
    expect(html).toContain("prose-img-btn");
    expect(html).not.toContain("<dialog");
  });
});
