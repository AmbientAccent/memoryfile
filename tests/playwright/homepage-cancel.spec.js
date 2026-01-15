const { test, expect } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

const coreJs = fs.readFileSync(
  path.resolve(__dirname, "../../lib/html-sqlite-core.js"),
  "utf8"
);

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
    window.eval(`
      MemoryFile = {
        saveHtmlFile: async (html, filename) => {
          window.__lastSavedHtml = { html, filename };
          return {
            success: true,
            method: "test-stub",
            savedInPlace: false,
            capabilities: {},
          };
        }
      };

      if (typeof db !== "undefined" && db && !db.__playwrightPatched) {
        const originalRun = db.run.bind(db);
        db.run = (sql, params) => {
          const text = typeof sql === "string" ? sql : "";
          if (text.includes("RELEASE mf_save") || text.includes("ROLLBACK TO mf_save")) {
            try {
              return originalRun(sql, params);
            } catch (err) {
              return;
            }
          }
          return originalRun(sql, params);
        };
        db.__playwrightPatched = true;
      }
    `);
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

function toUrl(testInfo, filePath) {
  const baseURL = testInfo.project.use.baseURL || "http://localhost:8765";
  const relative = path.relative(process.cwd(), filePath).replace(/\\/g, "/");
  return `${baseURL}/${relative}`;
}

function normalizeSavedHtml(html) {
  return html
    .replace(
      /<script\s+src="lib\/html-sqlite-core\.js"><\/script>/,
      `<script>\n${coreJs}\n</script>`
    )
    .replace(
      /<script\s+src="lib\/sql-wasm-inline\.js"><\/script>/,
      '<script src="/lib/sql-wasm-inline.js"></script>'
    );
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
  await testInfo.attach("save-a1.html", {
    body: saveA1Html,
    contentType: "text/html",
  });
  await require("fs").promises.writeFile(fileA1, saveA1Html, "utf8");
  await expect(page.locator("#commits .commit")).toHaveCount(2);

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await pageB.goto(toUrl(testInfo, fileA1));
  await waitForAppReady(pageB);
  await installSaveCapture(pageB);

  await expect(pageB.locator("#commits .commit")).toHaveCount(2);
  await pageB.fill("#input", "Commit from browser B");
  const saveB1 = await captureSavedHtml(pageB);
  await waitForSaveComplete(pageB);
  const saveB1Html = normalizeSavedHtml(saveB1.html);
  const fileB1 = testInfo.outputPath("save-b1.html");
  await testInfo.attach("save-b1.html", {
    body: saveB1Html,
    contentType: "text/html",
  });
  await require("fs").promises.writeFile(fileB1, saveB1Html, "utf8");
  await expect(pageB.locator("#commits .commit")).toHaveCount(3);

  await page.goto(toUrl(testInfo, fileB1));
  await waitForAppReady(page);
  await installSaveCapture(page);

  await expect(page.locator("#commits .commit")).toHaveCount(3);
  await page.fill("#input", "Commit from browser A again");
  await captureSavedHtml(page);
  await waitForSaveComplete(page);
  await expect(page.locator("#commits .commit")).toHaveCount(4);
});
