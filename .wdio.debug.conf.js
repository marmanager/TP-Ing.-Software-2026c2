import { config as base } from "./wdio.conf.js";
export const config = {
  ...base,
  afterTest: async (test, _ctx, { passed }) => {
    if (passed) return;
    const url = await browser.getUrl();
    const body = (await $("body").getText()).replace(/\n+/g, " | ").slice(0, 1200);
    console.log(`\n### FALLÓ: ${test.title}\n### URL: ${url}\n### BODY: ${body}\n`);
  },
};
