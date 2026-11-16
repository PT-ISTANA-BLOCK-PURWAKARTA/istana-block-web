"use client";

import { useEffect, useState } from "react";
import { waLink } from "@/lib/format";

type Props = {
  areaName: string;
  whatsapp: string;
};

export function LocalMobileDock({ areaName, whatsapp }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Muncul setelah scroll 180px
      if (window.scrollY > 180) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) return null;

  const waText = `Halo Istana Block, saya ingin cek harga dan stok paving block untuk pengiriman ke ${areaName}.`;
  const href = waLink(whatsapp, waText);

  return (
    <aside className="local-mobile-dock" aria-label={`Kontak Cepat WhatsApp ${areaName}`}>
      <a href={href} target="_blank" rel="noopener" className="mobile-dock-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.586 1.771.867 2.802.867 3.18 0 5.766-2.587 5.767-5.766.001-3.187-2.575-5.754-5.773-5.754zm4.17 7.625c-.173.486-.888.894-1.233.951-.345.058-.788.106-2.285-.516-1.785-.742-2.915-2.589-3.003-2.709-.088-.12-1.393-1.854-1.393-3.535 0-1.681.879-2.511 1.192-2.857.313-.346.684-.432.913-.432.228 0 .456.002.656.012.211.011.493-.08.77.587.287.694.975 2.378 1.06 2.551.086.173.143.375.029.605-.114.23-.172.374-.343.576-.172.202-.365.45-.522.604-.173.173-.353.361-.152.707.201.345.894 1.474 1.919 2.387 1.319 1.174 2.43 1.537 2.776 1.71.346.173.548.144.75-.087.202-.231.867-1.009 1.1-1.355.23-.346.462-.288.773-.173.313.115 1.979.933 2.319 1.104.34.172.569.258.654.402.086.144.086.837-.087 1.323z" />
        </svg>
        <span>Tanya Harga &amp; Ongkir ke {areaName} via WA</span>
      </a>
    </aside>
  );
}
