const { test, expect } = require("@playwright/test");
const { pathToFileURL } = require("url");
const fs = require("fs");

async function waitForAppReady(page) {
  await page.waitForFunction(
    () => document.querySelectorAll("#commits .commit").length > 0
  );
  await expect(page.locator("#input")).toBeEnabled();
}

async function installSaveCapture(page) {
  await page.evaluate(() => {
    window.__lastSavedHtml = null;
    window.__saveCaptureInstalled = true;
    window.showSaveFilePicker = async (options = {}) => {
      const suggestedName = options && options.suggestedName;
      return {
        createWritable: async () => ({
          write: async (contents) => {
            window.__lastSavedHtml = {
              html: contents,
              filename: suggestedName || "app.html",
            };
          },
          close: async () => {},
        }),
      };
    };
  });
}

async function captureSavedHtml(page) {
  await page.evaluate(() => {
    window.__lastSavedHtml = null;
  });
  await page.click("#btn-save");
  await page.waitForFunction(
    () => window.__lastSavedHtml && window.__lastSavedHtml.html
  );
  return page.evaluate(() => window.__lastSavedHtml);
}

async function waitForSaveComplete(page) {
  await expect(page.locator("#status-text")).toHaveText("Ready");
  await expect(page.locator("#input")).toHaveValue("");
}

test("homepage trust badge shows unverified, verified, tampered", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await waitForAppReady(page);
  await installSaveCapture(page);

  const badge = page.locator("#trust-mini-badge");
  await expect(badge).toHaveAttribute("data-status", "unverified");
  await expect(badge).toHaveText("Integrity: unverified");

  await page.fill("#input", "Commit for trust badge test");
  const saved = await captureSavedHtml(page);
  await waitForSaveComplete(page);

  const filename = saved.filename || "memoryfile.html";
  const verifiedPath = testInfo.outputPath(filename);
  await fs.promises.writeFile(verifiedPath, saved.html, "utf8");

  await page.goto(pathToFileURL(verifiedPath).href);
  await waitForAppReady(page);
  const verifiedBadge = page.locator("#trust-mini-badge");
  await expect(verifiedBadge).toHaveAttribute("data-status", "verified");
  await expect(verifiedBadge).toHaveText("Integrity: verified");

  const tamperedHtml = saved.html.replace(
    "</html>",
    "<!-- tampered -->\n</html>"
  );
  const tamperedPath = testInfo.outputPath("tampered", filename);
  await fs.promises.mkdir(testInfo.outputPath("tampered"), { recursive: true });
  await fs.promises.writeFile(tamperedPath, tamperedHtml, "utf8");

  await page.goto(pathToFileURL(tamperedPath).href);
  await waitForAppReady(page);
  const tamperedBadge = page.locator("#trust-mini-badge");
  await expect(tamperedBadge).toHaveAttribute("data-status", "tampered");
  await expect(tamperedBadge).toHaveText("Integrity: tampered");
});
