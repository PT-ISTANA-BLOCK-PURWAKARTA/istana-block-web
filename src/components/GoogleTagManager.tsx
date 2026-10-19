import Script from "next/script";

/**
 * Google Tag Manager untuk situs publik (container berisi Google Ads + GA4; lihat
 * docs/pelacakan-google-ads.md). Dimuat hanya di host SITE_URL (dan www.-nya), atau saat diuji lewat Tag Assistant
 * (URL berisi ?gtm_debug=…, diingat selama tab terbuka), supaya kunjungan staging *.workers.dev dan
 * Worker demo tidak masuk data iklan.
 */
export function GoogleTagManager({ id, siteUrl }: { id?: string; siteUrl: string }) {
  let host = "";
  try {
    host = new URL(siteUrl).hostname;
  } catch {
    /* SITE_URL kosong/tidak valid: jangan muat apa pun */
  }
  if (!id || !host) return null;
  const args = JSON.stringify([id, host]).replace(/</g, "\\u003c");
  const code = `(function(a){var i=a[0],h=a[1],ok=location.hostname===h||location.hostname==="www."+h;try{if(/[?&]gtm_debug=/.test(location.search))sessionStorage.setItem("ib_gtm_debug","1");ok=ok||sessionStorage.getItem("ib_gtm_debug")==="1"}catch(e){}if(!ok)return;window.dataLayer=window.dataLayer||[];window.dataLayer.push({"gtm.start":Date.now(),event:"gtm.js"});var s=document.createElement("script");s.async=true;s.src="https://www.googletagmanager.com/gtm.js?id="+encodeURIComponent(i);document.head.appendChild(s)})(${args});`;
  return (
    <Script id="gtm" strategy="afterInteractive">
      {code}
    </Script>
  );
}
