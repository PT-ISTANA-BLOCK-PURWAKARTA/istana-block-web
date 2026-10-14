import type { Settings } from "./settings";

/** "0264 200476" → "+62264200476" (format internasional untuk data terstruktur). */
function intlPhone(n: string) {
  const d = n.replace(/\D/g, "").replace(/^0/, "62");
  return d ? `+${d}` : undefined;
}

// Catatan: aggregateRating sengaja tidak dicantumkan. Google tidak menampilkan rating
// "self-serving" (ulasan tentang bisnis sendiri yang dipasang di situs bisnis itu).
export function localBusiness(s: Settings, siteUrl: string) {
  const office = intlPhone(s.phone_office);
  const mobile = intlPhone(s.phone);
  return {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    "@id": `${siteUrl}/#business`,
    name: s.company_name,
    legalName: s.legal_name,
    url: siteUrl,
    logo: `${siteUrl}/brand/logo-istana-block.png`,
    image: `${siteUrl}/img/pabrik/pabrik-mesin-paving.webp`,
    telephone: office ?? mobile,
    ...(office && mobile && office !== mobile
      ? { contactPoint: [{ "@type": "ContactPoint", contactType: "sales", telephone: mobile, availableLanguage: "id" }] }
      : {}),
    email: s.email,
    foundingDate: s.founded_year,
    address: { "@type": "PostalAddress", streetAddress: s.address, addressLocality: "Purwakarta", addressRegion: "Jawa Barat", addressCountry: "ID" },
    areaServed: s.service_area,
    openingHours: s.hours,
    ...(s.maps_url ? { hasMap: s.maps_url } : {}),
  };
}
