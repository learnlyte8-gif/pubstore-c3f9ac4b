import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchProducts from "./tools/search-products";
import getProduct from "./tools/get-product";
import listSuppliers from "./tools/list-suppliers";
import searchJobs from "./tools/search-jobs";
import listProperties from "./tools/list-properties";
import latestNews from "./tools/latest-news";
import createRfq from "./tools/create-rfq";

// Direct supabase.co issuer (never the .lovable.cloud proxy). Built from the
// project ref that Vite inlines at build time — keeps this file import-safe.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "pubstore-mcp",
  title: "PUBSTORE",
  version: "0.1.0",
  instructions:
    "Tools for the PUBSTORE marketplace. Search products, suppliers, jobs, properties, and news; fetch product details; and post an RFQ on behalf of the signed-in buyer.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchProducts, getProduct, listSuppliers, searchJobs, listProperties, latestNews, createRfq],
});
