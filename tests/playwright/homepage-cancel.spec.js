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
    window.showSaveFilePicker = async () => ({
      createWritable: async () => ({
        write: async (contents) => {
          window.__lastSavedHtml = { html: contents };
        },
        close: async () => {},
      }),
    });
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

async function expectFooterClean(page) {
  const footerText = await page.locator("footer").innerText();
  expect(footerText).not.toContain("Â");
}

function normalizeSavedHtml(html) {
  return html;
}

test("cancelled save does not create commit", async ({ page }) => {
  await page.addInitScript(() => {
    window.showSaveFilePicker = async () => {
      throw new DOMException("User cancelled", "AbortError");
    };
  });

  await page.goto("/");
  await waitForAppReady(page);

  const commits = page.locator("#commits .commit");
  await expect(commits).toHaveCount(1);

  await page.fill("#input", "Test entry for cancel");
  await page.click("#btn-save");

  const status = page.locator("#status-text");
  await expect(status).toHaveText("Cancelled");
  await expect(commits).toHaveCount(1);
  await expect(page.locator("#input")).toHaveValue("Test entry for cancel");
});

test("save across browsers preserves commit chain", async ({
  browser,
  page,
}, testInfo) => {
  await page.goto("/");
  await waitForAppReady(page);
  await installSaveCapture(page);

  await page.fill("#input", "Commit from browser A");
  const saveA1 = await captureSavedHtml(page);
  await waitForSaveComplete(page);
  const saveA1Html = normalizeSavedHtml(saveA1.html);
  const fileA1 = testInfo.outputPath("save-a1.html");
  await fs.promises.writeFile(fileA1, saveA1Html, "utf8");
  await expect(page.locator("#commits .commit")).toHaveCount(2);

  const contextB = await browser.newContext();
  await contextB.addInitScript(() => {
    window.showSaveFilePicker = async () => ({
      createWritable: async () => ({
        write: async (contents) => {
          window.__lastSavedHtml = { html: contents };
        },
        close: async () => {},
      }),
    });
  });
  const pageB = await contextB.newPage();
  await pageB.goto(pathToFileURL(fileA1).href);
  await waitForAppReady(pageB);
  await installSaveCapture(pageB);
  await expect(pageB.locator("#status-text")).toHaveText("Ready");
  await expectFooterClean(pageB);

  await expect(pageB.locator("#commits .commit")).toHaveCount(2);
  await pageB.fill("#input", "Commit from browser B");
  const saveB1 = await captureSavedHtml(pageB);
  await waitForSaveComplete(pageB);
  const saveB1Html = normalizeSavedHtml(saveB1.html);
  const fileB1 = testInfo.outputPath("save-b1.html");
  await fs.promises.writeFile(fileB1, saveB1Html, "utf8");
  await expect(pageB.locator("#commits .commit")).toHaveCount(3);

  await page.goto(pathToFileURL(fileB1).href);
  await waitForAppReady(page);
  await installSaveCapture(page);
  await expect(page.locator("#status-text")).toHaveText("Ready");
  await expectFooterClean(page);

  await expect(page.locator("#commits .commit")).toHaveCount(3);
  await page.fill("#input", "Commit from browser A again");
  await captureSavedHtml(page);
  await waitForSaveComplete(page);
  await expect(page.locator("#commits .commit")).toHaveCount(4);
});
