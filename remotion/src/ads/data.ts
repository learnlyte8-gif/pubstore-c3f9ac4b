import { staticFile } from "remotion";
import type { AdProps } from "./VerticalAd";

export const ADS: Record<string, AdProps> = {
  market: {
    vertical: "Market",
    eyebrow: "Wholesale & Retail",
    hook: "BUY SMARTER.",
    hookAccent: "SELL FASTER.",
    tagline: "Verified suppliers. Live drops. Shipped worldwide.",
    screen: staticFile("screens/market.png"),
    buyerBullets: [
      "Browse millions of products from vetted suppliers",
      "Compare prices, MOQ and shipping in one tap",
      "Chat, negotiate and order without leaving the app",
    ],
    supplierBullets: [
      "Open a free storefront in under 60 seconds",
      "Reach buyers across Africa and beyond",
      "Get paid securely with built-in checkout",
    ],
    statBig: "12K+",
    statLabel: "Verified suppliers already on Pubstore",
    cta: "Pubstore — your marketplace, in your pocket.",
    accent: "#F5C242",
  },
};
