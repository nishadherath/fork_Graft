/**
 * The secret rule, pinned value by value.
 *
 * A key node's signature and body text are printed by `ask` and searched by `grep`,
 * so a credential that reaches either is a leak. Each planted value below comes
 * from the acceptance fixture (`docs/acceptance/2026-10-13/make-fixtures.mjs`, case
 * 5), grouped by the file it sat in, and none may appear anywhere in the nodes the
 * extractor returns. The values are fake and exist only to be searched for.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import {
  extractStructured,
  structuredLangOf,
  warmStructuredGrammars,
} from "../src/graph/structured/index.js";
import { MIN_OPAQUE_VALUE_CHARS, isSecret } from "../src/graph/structured/shared.js";

before(async () => {
  await warmStructuredGrammars(["json", "yaml", "ini"]);
});

function doc(lines: string[]): string {
  return lines.join("\n") + "\n";
}

/** Everything the extractor returned for `source`, as one searchable string. Asserts
 * that keys were found at all, so a grammar that failed to load cannot make the
 * leak checks pass by returning only the file node. */
function everything(rel: string, source: string): string {
  const { nodes } = extractStructured(rel, source, structuredLangOf(rel)!);
  assert.ok(nodes.some((n) => n.kind === "key"), `${rel} produced no key nodes`);
  return JSON.stringify(nodes);
}

const PLANTED: Array<{ rel: string; source: string; values: string[] }> = [
  {
    rel: "secrets/config.json",
    source: doc([
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
    ]),
    values: [
      "SHORTKEY01", "hunter2pw", "tok_abc123", "QmFzZTY0LW", "AKIAIOSFODNN7EXAMPLE", "wJalrXUtnFEMI",
      "MIIEvQIBADANBg", "dbpass99", "urlpass77", "abcdefghijklmnopqrstuvwxyz012345", "dXNlcjpwYXNz",
    ],
  },
  {
    rel: "secrets/settings.yaml",
    source: doc([
      "github_token: ghp_1234567890abcdefghijklmnopqrstuvwxyz",
      "smtp_password: smtppw55",
      "oauth:",
      "  client_secret: clientsecret44",
      "  client_id: client-id-public",
    ]),
    values: ["ghp_1234567890", "smtppw55", "clientsecret44"],
  },
  {
    rel: "secrets/app.toml",
    source: doc(["[auth]", 'api-key = "tomlkey66"', 'secret = "tomlsecret77"', 'display = "shown-value"']),
    values: ["tomlkey66", "tomlsecret77"],
  },
  {
    rel: "secrets/app.ini",
    source: doc(["[db]", "password = inipass88", "host = localhost"]),
    values: ["inipass88"],
  },
  {
    rel: "secrets/credentials.json",
    source: doc(["{", '  "type": "service_account",', '  "private_key_id": "pkid77",', '  "client_email": "svc@example.iam.gserviceaccount.com"', "}"]),
    values: ["pkid77"],
  },
];

for (const { rel, source, values } of PLANTED) {
  test(`secrets: no planted value from ${rel} reaches a node`, () => {
    const all = everything(rel, source);
    for (const value of values) assert.ok(!all.includes(value), `${value} leaked from ${rel}`);
  });
}

test("secrets: the acceptance rows that leaked under the 33-character rule are hidden", () => {
  // AWS access key id: 20 characters and a name with `access_key` but not `api_key`.
  assert.equal(isSecret("aws_access_key_id", "AKIAIOSFODNN7EXAMPLE"), true);
  // 32 characters, a name that says nothing.
  assert.equal(isSecret("exactly32", "abcdefghijklmnopqrstuvwxyz012345"), true);
  // A header value with a space under a name that says `auth`.
  assert.equal(isSecret("auth", "Basic dXNlcjpwYXNz"), true);
});

test("secrets: the opaque-value boundary is MIN_OPAQUE_VALUE_CHARS, no whitespace", () => {
  assert.equal(MIN_OPAQUE_VALUE_CHARS, 20);
  assert.equal(isSecret("note", "a".repeat(MIN_OPAQUE_VALUE_CHARS - 1)), false, "one short of the boundary is shown");
  assert.equal(isSecret("note", "a".repeat(MIN_OPAQUE_VALUE_CHARS)), true, "the boundary itself is hidden");
  assert.equal(isSecret("note", "word ".repeat(10).trim()), false, "long text with spaces is prose, not a credential");
});

test("secrets: the credential name words, and the names that only look like them", () => {
  for (const name of ["access_key", "accessKey", "AWS_ACCESS_KEY_ID", "credentials", "client.credential", "bearer", "bearerToken", "Authorization", "auth", "proxy_auth", "basic-auth", "basicAuth", "auth.header"]) {
    assert.equal(isSecret(name, "x"), true, `${name} must hide its value`);
  }
  // `auth` is matched as a word so a package's `author` or a Cargo `authors` list stays visible.
  for (const name of ["author", "authors", "authority", "key", "monkey", "publicKey"]) {
    assert.equal(isSecret(name, "x"), false, `${name} must keep its value`);
  }
});

test("secrets: a URL with userinfo is hidden whatever its length, a plain URL is not", () => {
  assert.equal(isSecret("url", "postgres://u:p@h/db"), true, "19 characters, under the opaque threshold");
  assert.equal(isSecret("remote", "ssh://git@h/r"), true, "a user name alone is still userinfo");
  assert.equal(isSecret("remote", "https://ghp_x@h.io/r"), true, "a token as the user name");
  assert.equal(isSecret("home", "http://a.io/x"), false, "no userinfo, under the threshold");
  assert.equal(isSecret("home", "http://a.io/x@y"), false, "an @ after the first slash is path, not userinfo");
  assert.equal(isSecret("email", "me@example.com"), false, "an address is not a URL");
});

test("secrets: values with no credential name and nothing opaque stay visible", () => {
  const all = everything("c.yaml", doc(["client_id: client-id-public", "host: localhost", "mode: oidc"]));
  for (const shown of ["client-id-public", "localhost", "oidc"]) assert.ok(all.includes(shown), `${shown} should stay searchable`);
});
