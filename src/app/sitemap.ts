import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/config";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/bestellen", "/impressum", "/datenschutz", "/agb"].map(path => ({ url: `${siteUrl()}${path}`, changeFrequency: path === "" ? "weekly" : "monthly", priority: path === "" ? 1 : path === "/bestellen" ? .8 : .2 }));
}
