import { defineClientConfig } from "vuepress/client";
import BuildStatus from "./components/BuildStatus.vue";

export default defineClientConfig({
  enhance: ({ app, router, siteData }) => {
    app.component("BuildStatus", BuildStatus);
  },
});