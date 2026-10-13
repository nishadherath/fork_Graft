// Builds the Stage 6 acceptance fixture repository. Usage: node make-fixtures.mjs <root> [--huge]
// Every file is written with LF endings and no BOM; line numbers quoted in the
// acceptance report refer to these files as written.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";

const root = process.argv[2];
const huge = process.argv.includes("--huge");
if (!root) throw new Error("root required");

const put = (rel, text) => {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, typeof text === "string" ? text : Buffer.from(text));
};
const L = (...lines) => lines.join("\n") + "\n";

// ---- case 1: one fixture per family, line numbers known ----
put("docs/guide.md", L(
  "---",                                   // 1
  "title: Guide",                          // 2
  "version: 2",                            // 3
  "---",                                   // 4
  "Preface line.",                         // 5
  "",                                      // 6
  "# Install",                             // 7
  "",                                      // 8
  "Run `npm install`.",                    // 9
  "",                                      // 10
  "## Windows",                            // 11
  "",                                      // 12
  "Use nvm4w.",                            // 13
  "",                                      // 14
  "### Paths",                             // 15
  "",                                      // 16
  "Spaces are fine.",                      // 17
  "",                                      // 18
  "## Linux",                              // 19
  "",                                      // 20
  "apt.",                                  // 21
  "",                                      // 22
  "# Usage",                               // 23
  "",                                      // 24
  "Type [the install steps](#install) and see [the config](../cfg/app.json).", // 25
  "",                                      // 26
  "```ts",                                 // 27
  "export function sample() {",            // 28
  "  return 1;",                           // 29
  "}",                                     // 30
  "```",                                   // 31
  "",                                      // 32
  "Closing line.",                         // 33
));

put("cfg/app.json", L(
  "{",                                     // 1
  '  "name": "demo",',                     // 2
  '  "server": {',                         // 3
  '    "port": 8080,',                     // 4
  '    "tls": {',                          // 5
  '      "cert": "a.crt",',                // 6
  '      "ciphers": {',                    // 7
  '        "strong": true,',               // 8
  '        "weak": {',                     // 9
  '          "allowed": false',            // 10
  "        }",                             // 11
  "      }",                               // 12
  "    }",                                 // 13
  "  },",                                  // 14
  '  "files": [',                          // 15
  '    { "name": "first", "size": 1 },',   // 16
  '    { "name": "second", "size": 2 }',   // 17
  "  ]",                                   // 18
  "}",                                     // 19
));

put("cfg/app.yaml", L(
  "name: demo",                            // 1
  "server:",                               // 2
  "  port: 8080",                          // 3
  "  hosts:",                              // 4
  "    - name: alpha",                     // 5
  "      ip: 10.0.0.1",                    // 6
  "    - name: beta",                      // 7
  "      ip: 10.0.0.2",                    // 8
  "# comment",                             // 9
  "logging:",                              // 10
  "  level: info",                         // 11
));

put("cfg/app.toml", L(
  'title = "demo"',                        // 1
  "",                                      // 2
  "[server]",                              // 3
  "port = 8080",                           // 4
  "hosts = [",                             // 5
  '  "a",',                                // 6
  '  "b",',                                // 7
  "]",                                     // 8
  "",                                      // 9
  "# about tls",                           // 10
  "[server.tls]",                          // 11
  'cert = "a.crt"',                        // 12
  "",                                      // 13
  "[[plugins]]",                           // 14
  'name = "auth"',                         // 15
  "enabled = true",                        // 16
  "",                                      // 17
  "[[plugins]]",                           // 18
  'name = "cache"',                        // 19
));

put("cfg/app.ini", L(
  "[core]",                                // 1
  "name = demo",                           // 2
  "",                                      // 3
  "; comment",                             // 4
  '[remote "origin"]',                     // 5
  "url = https://example.com/x.git",       // 6
  "fetch = +refs/heads/*:refs/remotes/origin/*", // 7
));

put("web/site.css", L(
  ":root {",                               // 1
  "  --brand: #123456;",                   // 2
  "}",                                     // 3
  "",                                      // 4
  ".btn,",                                 // 5
  ".btn-primary {",                        // 6
  "  color: var(--brand);",                // 7
  "}",                                     // 8
  "",                                      // 9
  "@media (min-width: 600px) {",           // 10
  "  .btn {",                              // 11
  "    padding: 2px;",                     // 12
  "  }",                                   // 13
  "}",                                     // 14
  "",                                      // 15
  "@keyframes spin {",                     // 16
  "  from { transform: rotate(0deg); }",   // 17
  "  to { transform: rotate(360deg); }",   // 18
  "}",                                     // 19
));

put("web/site.scss", L(
  "$accent: red;",                         // 1
  "",                                      // 2
  ".card {",                               // 3
  "  color: $accent;",                     // 4
  "  &:hover {",                           // 5
  "    color: blue;",                      // 6
  "  }",                                   // 7
  "}",                                     // 8
));

put("web/index.html", L(
  "<!DOCTYPE html>",                       // 1
  "<html>",                                // 2
  "<head>",                                // 3
  '  <link rel="stylesheet" href="site.css">', // 4
  "  <style>",                             // 5
  "    #main { margin: 0; }",              // 6
  "  </style>",                            // 7
  '  <script src="app.js"></script>',      // 8
  "</head>",                               // 9
  "<body>",                                // 10
  '  <div id="main">',                     // 11
  '    <form name="login" action="/login">', // 12
  '      <input id="user" name="user">',   // 13
  '      <button id="go" class="btn">Go</button>', // 14
  "    </form>",                           // 15
  "  </div>",                              // 16
  "  <script>",                            // 17
  "    function greet() {",                // 18
  '      return "hi";',                    // 19
  "    }",                                 // 20
  "  </script>",                           // 21
  "</body>",                               // 22
  "</html>",                               // 23
));

put("web/App.svelte", L(
  "<script>",                              // 1
  '  export let name = "x";',              // 2
  "  function shout() {",                  // 3
  "    return name.toUpperCase();",        // 4
  "  }",                                   // 5
  "</script>",                             // 6
  "",                                      // 7
  '<main id="root">',                      // 8
  '  <h1 id="title">{name}</h1>',          // 9
  "</main>",                               // 10
  "",                                      // 11
  "<style>",                               // 12
  "  #title { color: red; }",              // 13
  "</style>",                              // 14
));

put("web/Page.astro", L(
  "---",                                   // 1
  "const items = [1, 2];",                 // 2
  "function count() {",                    // 3
  "  return items.length;",                // 4
  "}",                                     // 5
  "---",                                   // 6
  '<section id="list">',                   // 7
  '  <ul id="items"></ul>',                // 8
  "</section>",                            // 9
));

put("xml/AndroidManifest.xml", L(
  '<?xml version="1.0" encoding="utf-8"?>', // 1
  '<manifest xmlns:android="http://schemas.android.com/apk/res/android"', // 2
  '    package="com.example.app">',        // 3
  '    <application android:name=".App">', // 4
  '        <activity android:name=".MainActivity">', // 5
  "            <intent-filter>",           // 6
  '                <action android:name="android.intent.action.MAIN" />', // 7
  "            </intent-filter>",          // 8
  "        </activity>",                   // 9
  "    </application>",                    // 10
  "</manifest>",                           // 11
));

put("xml/Info.plist", L(
  '<?xml version="1.0" encoding="UTF-8"?>', // 1
  '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">', // 2
  '<plist version="1.0">',                 // 3
  "<dict>",                                // 4
  "  <key>CFBundleName</key>",             // 5
  "  <string>Demo</string>",               // 6
  "  <key>Nested</key>",                   // 7
  "  <dict>",                              // 8
  "    <key>Inner</key>",                  // 9
  "    <true/>",                           // 10
  "  </dict>",                             // 11
  "</dict>",                               // 12
  "</plist>",                              // 13
));

put("xml/pom.xml", L(
  "<project>",                             // 1
  "  <modelVersion>4.0.0</modelVersion>",  // 2
  "  <parent>",                            // 3
  "    <groupId>org.example</groupId>",    // 4
  "    <artifactId>parent</artifactId>",   // 5
  "    <version>1</version>",              // 6
  "  </parent>",                           // 7
  "  <dependencies>",                      // 8
  "    <dependency>",                      // 9
  "      <groupId>junit</groupId>",        // 10
  "      <artifactId>junit</artifactId>",  // 11
  "      <version>4.13</version>",         // 12
  "    </dependency>",                     // 13
  "  </dependencies>",                     // 14
  "</project>",                            // 15
));

put("tooling/build.gradle", L(
  "plugins {",                             // 1
  "  id 'java'",                           // 2
  "  id 'application'",                    // 3
  "}",                                     // 4
  "",                                      // 5
  "dependencies {",                        // 6
  "  implementation 'org.x:y:1.0'",        // 7
  "}",                                     // 8
  "",                                      // 9
  "task hello {",                          // 10
  "  doLast {",                            // 11
  "    println 'hi'",                      // 12
  "  }",                                   // 13
  "}",                                     // 14
  "",                                      // 15
  "tasks.register('clean2') {",            // 16
  "  delete 'out'",                        // 17
  "}",                                     // 18
));

put("tooling/Makefile", L(
  "CC = gcc",                              // 1
  "",                                      // 2
  "all: build",                            // 3
  "",                                      // 4
  "build: main.o",                         // 5
  "\t$(CC) -o app main.o",                 // 6
  "",                                      // 7
  "main.o: main.c",                        // 8
  "\t$(CC) -c main.c",                     // 9
  "",                                      // 10
  ".PHONY: clean",                         // 11
  "clean:",                                // 12
  "\trm -f app main.o",                    // 13
));

put("tooling/Dockerfile", L(
  "FROM node:20 AS deps",                  // 1
  "WORKDIR /app",                          // 2
  "COPY package.json .",                   // 3
  "RUN npm ci",                            // 4
  "",                                      // 5
  "# the runtime stage",                   // 6
  "FROM node:20-slim AS runtime",          // 7
  "COPY --from=deps /app /app",            // 8
  'CMD ["node", "scripts/start.mjs"]',     // 9
));

put("tooling/run.sh", L(
  "#!/bin/bash",                           // 1
  "set -e",                                // 2
  "",                                      // 3
  "greet() {",                             // 4
  '  echo "hi $1"',                        // 5
  "}",                                     // 6
  "",                                      // 7
  "function farewell {",                   // 8
  "  echo bye",                            // 9
  "}",                                     // 10
  "",                                      // 11
  "greet world",                           // 12
));

put("tooling/run.ps1", L(
  "param([string]$Name)",                  // 1
  "",                                      // 2
  "function Get-Greeting {",               // 3
  "  param($Who)",                         // 4
  '  "hi $Who"',                           // 5
  "}",                                     // 6
  "",                                      // 7
  "Get-Greeting $Name",                    // 8
));

put("tooling/CMakeLists.txt", L(
  "cmake_minimum_required(VERSION 3.10)",  // 1
  "project(demo)",                         // 2
  "",                                      // 3
  "function(add_demo name)",               // 4
  "  add_executable(${name} main.c)",      // 5
  "endfunction()",                         // 6
  "",                                      // 7
  "add_library(core STATIC core.c)",       // 8
  "add_executable(app",                    // 9
  "  main.c",                              // 10
  "  util.c)",                             // 11
  "add_test(NAME smoke COMMAND app)",      // 12
));

// ---- case 6: every CommonMark heading form ----
put("headings/forms.md", L(
  "Title Setext One",                      // 1
  "================",                      // 2
  "",                                      // 3
  "Intro text.",                           // 4
  "",                                      // 5
  "Title Setext Two",                      // 6
  "----------------",                      // 7
  "",                                      // 8
  "# ATX Plain",                           // 9
  "",                                      // 10
  "## ATX Closed ##",                      // 11
  "",                                      // 12
  "### ATX Trailing Spaces   ",            // 13
  "",                                      // 14
  "#### ATX Closed Trailing ####   ",      // 15
  "",                                      // 16
  "```",                                   // 17
  "# Not a heading in a fence",            // 18
  "```",                                   // 19
  "",                                      // 20
  "~~~md",                                 // 21
  "## Not a heading in a tilde fence",     // 22
  "~~~",                                   // 23
  "",                                      // 24
  "> # Quoted Heading",                    // 25
  "> quoted text",                         // 26
  "",                                      // 27
  "##### Five",                            // 28
  "",                                      // 29
  "###### Six",                            // 30
  "",                                      // 31
  "####### Seven hashes is not a heading", // 32
  "",                                      // 33
  "#NoSpace is not a heading",             // 34
  "",                                      // 35
  "    # Indented code is not a heading",  // 36
  "",                                      // 37
  "Multi line setext",                     // 38
  "second line",                           // 39
  "===",                                   // 40
  "",                                      // 41
  "- # In a list item",                    // 42
  "",                                      // 43
  "<div>",                                 // 44
  "# Inside an HTML block",                // 45
  "</div>",                                // 46
  "",                                      // 47
  "\\# Escaped hash",                      // 48
  "",                                      // 49
  "#\tTab After Hash",                     // 50
  "",                                      // 51
  "# ",                                    // 52
  "",                                      // 53
  "Last paragraph.",                       // 54
));

// ---- case 5: secrets ----
put("secrets/config.json", L(
  "{",
  '  "api_key": "SHORTKEY01",',
  '  "password": "hunter2pw",',
  '  "token": "tok_abc123",',
  '  "innocent": "QmFzZTY0LWxvb2tpbmctb3BhcXVlLXZhbHVlLXRoYXQtaXMtbG9uZw==",',
  '  "aws_access_key_id": "AKIAIOSFODNN7EXAMPLE",',
  '  "secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",',
  '  "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7\\n-----END PRIVATE KEY-----",',
  '  "db": { "passwd": "dbpass99", "url": "postgres://user:urlpass77@host/db" },',
  '  "exactly32": "abcdefghijklmnopqrstuvwxyz012345",',
  '  "auth": "Basic dXNlcjpwYXNz"',
  "}",
));
put("secrets/settings.yaml", L(
  "github_token: ghp_1234567890abcdefghijklmnopqrstuvwxyz",
  "smtp_password: smtppw55",
  "oauth:",
  "  client_secret: clientsecret44",
  "  client_id: client-id-public",
));
put("secrets/app.toml", L(
  "[auth]",
  'api-key = "tomlkey66"',
  'secret = "tomlsecret77"',
  'display = "shown-value"',
));
put("secrets/app.ini", L(
  "[db]",
  "password = inipass88",
  "host = localhost",
));
put("secrets/server.pem", L("-----BEGIN CERTIFICATE-----", "PEMBODY11", "-----END CERTIFICATE-----"));
put("secrets/server.key", L("-----BEGIN RSA PRIVATE KEY-----", "KEYBODY22", "-----END RSA PRIVATE KEY-----"));
put("secrets/.env", L("DATABASE_URL=postgres://u:envpass33@h/db", "API_TOKEN=envtoken44"));
put("secrets/package-lock.json", L('{ "name": "x", "lockfileVersion": 3, "packages": { "": { "name": "LOCKNAME55" } } }'));
put("secrets/pnpm-lock.yaml", L("lockfileVersion: '9.0'", "packages:", "  LOCKPKG66: {}"));
put("secrets/credentials.json", L(
  "{",
  '  "type": "service_account",',
  '  "private_key_id": "pkid77",',
  '  "client_email": "svc@example.iam.gserviceaccount.com"',
  "}",
));
put("secrets/notes.md", L("# Notes", "", "The staging token is PROSETOKEN88, do not share."));

// ---- case 4: a 10,000-key JSON, four levels deep ----
{
  const obj = {};
  for (let a = 0; a < 10; a++) {
    const A = (obj[`a${a}`] = {});
    for (let b = 0; b < 10; b++) {
      const B = (A[`b${b}`] = {});
      for (let c = 0; c < 10; c++) {
        const C = (B[`c${c}`] = {});
        for (let d = 0; d < 9; d++) C[`d${d}`] = a * 1000 + b * 100 + c * 10 + d;
      }
    }
  }
  put("big/keys.json", JSON.stringify(obj, null, 2) + "\n");
}
put("deep/deep.json", L(
  "{",
  '  "l1": {',
  '    "l2": {',
  '      "l3": {',
  '        "l4": {',
  '          "l5": {',
  '            "l6": "leaf"',
  "          }",
  "        }",
  "      }",
  "    }",
  "  }",
  "}",
));

// ---- case 7: workflow admit ----
put(".github/workflows/ci.yml", L("name: CI", "on: push", "jobs:", "  verify:", "    runs-on: ubuntu-latest", "    steps:", "      - run: npm test"));
put(".github/workflows/sub/nested.yml", L("name: Nested", "on: push"));
put(".github/workflows/notes.md", L("# Workflow notes"));
put(".github/workflows/.hidden.yml", L("name: Hidden"));
put(".github/dependabot.yml", L("version: 2", "updates: []"));
put(".github/ISSUE_TEMPLATE/bug.yml", L("name: Bug", "body: []"));
put(".github/CODEOWNERS", L("* @owner"));
put(".github/FUNDING.yml", L("github: owner"));

// ---- code that names keys and sections (edges, case 8) ----
put("src/app.ts", L(
  'import { readFileSync } from "node:fs";',
  'const cfg = JSON.parse(readFileSync("cfg/app.json", "utf8"));',
  "export const port = cfg.server.port;",
  'export const section = "Install";',
  "export function start() {",
  "  return port;",
  "}",
));
put("package.json", L('{ "name": "accept-fx", "scripts": { "test": "node scripts/start.mjs" } }'));

// ---- PDFs ----
function pdf(pages, padBytes = 0) {
  // objects: 1 catalog, 2 pages, 3 font, then per page: page obj + content obj; last: padding
  const objs = [];
  const add = (body) => { objs.push(body); return objs.length; };
  add(null); add(null); // placeholders 1, 2
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds = [];
  for (const lines of pages) {
    const ops = ["BT", "/F1 18 Tf", "72 720 Td", ...lines.flatMap((t, i) => [i === 0 ? null : "0 -24 Td", `(${t.replace(/[()\\]/g, "\\$&")}) Tj`]).filter(Boolean), "ET"].join("\n");
    const content = add(`<< /Length ${Buffer.byteLength(ops)} >>\nstream\n${ops}\nendstream`);
    const page = add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`);
    pageIds.push(page);
  }
  if (padBytes > 0) add(`<< /Length ${padBytes} >>\nstream\n${"x".repeat(padBytes)}\nendstream`);
  objs[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[1] = `<< /Type /Pages /Kids [${pageIds.map((p) => `${p} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let out = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((body, i) => { offsets.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
put("docs/manual.pdf", pdf([["Chapter One", "First page body."], ["Chapter Two", "Second page body."]]));
if (huge) put("pdf/huge.pdf", pdf([["Huge", "Padding follows."]], 50_000_000));

execSync("git init -q", { cwd: root });
console.log(`fixture written at ${root}${huge ? " (with pdf/huge.pdf)" : ""}`);
