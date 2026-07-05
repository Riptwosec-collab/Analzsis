"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");

const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "index.html");
const html = fs.readFileSync(htmlPath, "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function wait(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const logs = [];
  const virtualConsole = new VirtualConsole();

  for (const level of ["error", "warn", "info", "log"]) {
    virtualConsole.on(level, (...args) => logs.push({ level, message: args.join(" ") }));
  }
  virtualConsole.on("jsdomError", error => logs.push({ level: "jsdomError", message: error.message }));

  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    resources: "usable",
    url: "http://localhost/",
    pretendToBeVisual: true,
    virtualConsole
  });

  const { window } = dom;
  window.addEventListener("error", event => {
    logs.push({ level: "window.error", message: event.message });
  });
  window.addEventListener("unhandledrejection", event => {
    logs.push({ level: "unhandledrejection", message: String(event.reason) });
  });

  await wait(500);

  const { document } = window;
  assert(document.readyState === "complete", "document did not finish loading");
  assert(document.title.includes("Smart IP"), "unexpected page title");

  const fatalLogs = logs.filter(log => ["error", "jsdomError", "window.error", "unhandledrejection"].includes(log.level));
  assert(fatalLogs.length === 0, `fatal browser logs found: ${JSON.stringify(fatalLogs, null, 2)}`);

  const selfTest = logs.find(log => log.message.includes("[Self-Test]"));
  assert(selfTest && /36\/36 passed/.test(selfTest.message), `self-test did not pass: ${selfTest ? selfTest.message : "missing"}`);

  const exampleButton = document.getElementById("btnExample");
  assert(exampleButton, "missing example button");
  exampleButton.click();

  await wait(500);

  const summaryText = document.getElementById("summaryZone").textContent;
  const tabText = [...document.querySelectorAll(".tab")].map(tab => tab.textContent.trim()).join(" | ");
  const toastText = [...document.querySelectorAll(".toast")].map(toast => toast.textContent.trim()).join(" | ");

  assert(summaryText.includes("Detected Devices"), "summary did not render");
  assert(summaryText.includes("Likely Free IPs"), "free IP summary did not render");
  assert(tabText.includes("Used IPs6"), "used IP tab count did not render");
  assert(tabText.includes("Conflict & Anomaly9"), "conflict tab count did not render");
  assert(toastText.includes("วิเคราะห์เสร็จ"), "analysis completion toast did not render");

  window.close();
  console.log("Smoke test passed: index.html loads, self-test passes, sample analysis renders.");
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
