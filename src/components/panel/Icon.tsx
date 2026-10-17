/** Ikon garis sederhana untuk menu panel (24×24, stroke mengikuti warna teks). */
const PATHS = {
  home: "M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z",
  invoice: "M7 3h10a1 1 0 0 1 1 1v16l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1zM9 8h6M9 12h6M9 16h3",
  receive: "M12 4v10m0 0-4-4m4 4 4-4M5 18h14",
  cart: "M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L19.5 8H6.2M9 19.5h.01M17 19.5h.01",
  pay: "M12 20V10m0 0-4 4m4-4 4 4M5 6h14",
  cash: "M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6.5 10v4M17.5 10v4",
  book: "M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19M9 7h6",
  chart: "M4 20h16M7 16v-5M12 16V7M17 16v-8",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.8c1.8.7 3 2.5 3 5.2",
  box: "M12 3 4 7v10l8 4 8-4V7zM4 7l8 4 8-4M12 11v10",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-1.7 1L15 20.5h-4l-.4-2.1a7 7 0 0 1-1.7-1l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-3L5 9.3l2-3.4 1.9.7a7 7 0 0 1 1.7-1L11 3.5h4l.4 2.1a7 7 0 0 1 1.7 1l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 3z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5",
  clipboard: "M9 4h6v3H9zM9 5.5H6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6.5a1 1 0 0 0-1-1h-3M8.5 12h7M8.5 16h5",
  truck: "M2.5 6h11v10h-11zM13.5 9.5h4l3 3.5V16h-7M6.5 18.5a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6zM17 18.5a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z",
  stack: "M3 9.5 12 5l9 4.5-9 4.5zM3 14l9 4.5 9-4.5",
  factory: "M3 20V10l5 3V10l5 3V10l5 3V4h3v16zM7 17h2M12 17h2",
  adjust: "M5 4v16M12 4v16M19 4v16M3 9h4M10 15h4M17 7h4",
  car: "M4 16V11l2-5h12l2 5v5zM4 16v2.5M20 16v2.5M7.5 13h.01M16.5 13h.01M4 11h16",
  id: "M3 6h18v12H3zM9 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5.5 16c.5-1.5 1.8-2.3 3.5-2.3s3 .8 3.5 2.3M15 10h3.5M15 13.5h3.5",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.7 3.5 5.7 3.5 9s-1 6.3-3.5 9c-2.5-2.7-3.5-5.7-3.5-9s1-6.3 3.5-9z",
  doc: "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6",
  page: "M4 4h16v16H4zM4 9h16M9 9v11",
  star: "M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  logout: "M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l4-4-4-4M14 12H4",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  pin: "M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21zM12 12.3a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  phone: "M8 2.8h8a1 1 0 0 1 1 1v16.4a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3.8a1 1 0 0 1 1-1zM11 18h2",
  mail: "M3.5 6h17v12h-17zM4 6.5l8 6 8-6",
  lock: "M6 10.5h12V20H6zM8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7M12 14.5v2",
  camera: "M4 7.5h3.5L9 5h6l1.5 2.5H20V19H4zM12 16.5a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6z",
  route: "M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h7.5a3 3 0 0 0 0-6h-7a3 3 0 0 1 0-6H16",
  signal: "M5 19v-3M9.5 19v-6.5M14 19V9.5M18.5 19V5.5",
  check: "M5 12.5l4.5 4.5L19 7.5",
  back: "M15 5l-7 7 7 7",
  chevron: "M9 5l7 7-7 7",
  ledger: "M5 3.5h14v17H5zM9 3.5v17M12 8h4.5M12 12h4.5M12 16h3",
  web: "M3.5 5h17v14h-17zM3.5 9h17M6.5 7h.01M9 7h.01M7 12.5h5M7 15.5h8",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
