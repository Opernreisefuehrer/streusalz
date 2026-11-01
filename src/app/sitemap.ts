import type { MetadataRoute } from "next";
import { siteUrl, isLiveReady } from "@/lib/config";
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["", ...(isLiveReady() ? ["/bestellen"] : []), "/impressum", "/datenschutz", "/agb"];
  return paths.map(path => ({ url: `${siteUrl()}${path}`, changeFrequency: path === "" ? "weekly" : "monthly", priority: path === "" ? 1 : path === "/bestellen" ? .8 : .2 }));
}
