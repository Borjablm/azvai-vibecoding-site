import { defineConfig } from "astro/config";
import netlify from "@astrojs/netlify";

export default defineConfig({
  site: "https://ai.azvai.com",
  adapter: netlify(),
});
