/**
 * XML: Android resources and manifests, Maven poms, property lists and Interface
 * Builder files. Fixtures are arrays of lines, so expected line numbers are the
 * indices + 1. The XML scanner is hand-written because the bundled XML grammar
 * crashes on this runtime; these tests are what keeps it honest.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpRepo } from "./helpers.js";
import { extractStructured, structuredLangOf } from "../src/graph/structured/index.js";
import { buildGraph } from "../src/graph/build.js";
import { checkGraph } from "../src/graph/check.js";
import { readGraph, wiringPath } from "../src/graph/write.js";
import { patchBuildConfig } from "../src/util/state.js";
import type { NodeV1 } from "../src/graph/types.js";

function doc(lines: string[], eol = "\n"): string {
  return lines.join(eol) + eol;
}

function parse(source: string, rel: string) {
  return extractStructured(rel, source, structuredLangOf(rel)!);
}

function spans(source: string, rel: string): Record<string, string> {
  return Object.fromEntries(parse(source, rel).nodes.filter((n) => n.kind !== "file").map((n) => [n.name, n.span]));
}

function byName(nodes: NodeV1[], name: string): NodeV1 {
  const hit = nodes.find((n) => n.name === name);
  assert.ok(hit, `no node ${name} (got: ${nodes.map((n) => n.name).join(", ")})`);
  return hit;
}

const MANIFEST = [
  '<?xml version="1.0" encoding="utf-8"?>',                                   //  1
  '<manifest xmlns:android="http://schemas.android.com/apk/res/android"',     //  2
  '    package="a.b">',                                                       //  3
  '  <application android:name=".App">',                                      //  4
  '    <activity android:name=".Main" android:exported="true">',              //  5
  "      <intent-filter>",                                                    //  6
  '        <action android:name="android.intent.action.MAIN"/>',              //  7
  "      </intent-filter>",                                                   //  8
  "    </activity>",                                                          //  9
  "  </application>",                                                         // 10
  "</manifest>",                                                              // 11
];

test("xml: an Android manifest's named components get exact spans", () => {
  assert.deepEqual(spans(doc(MANIFEST), "AndroidManifest.xml"), {
    "application[name=.App]": "L4-L10",
    "activity[name=.Main]": "L5-L9",
    "action[name=android.intent.action.MAIN]": "L7-L7",
  });
});

test("xml: a layout's android:id elements, including a multi-line tag", () => {
  const layout = [
    '<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android" android:id="@+id/root">', // 1
    "  <Button",                      // 2
    '      android:id="@+id/submit"', // 3
    '      android:text="Go" />',     // 4
    '  <TextView android:id="@id/title"/>', // 5
    "</LinearLayout>",                // 6
  ];
  const nodes = parse(doc(layout), "res/layout/main.xml").nodes;
  assert.deepEqual(
    nodes.filter((n) => n.kind === "element").map((n) => [n.name, n.span]),
    [["LinearLayout#root", "L1-L6"], ["Button#submit", "L2-L4"], ["TextView#title", "L5-L5"]],
  );
  assert.equal(byName(nodes, "Button#submit").kind, "element");
  assert.equal(byName(nodes, "Button#submit").id, "res/layout/main.xml#element:Button#submit");
});

test("xml: string resources are found by name and carry their text", () => {
  const nodes = parse(doc(["<resources>", '  <string name="app_name">Demo &amp; Co</string>', "</resources>"]), "strings.xml").nodes;
  const s = byName(nodes, "string[name=app_name]");
  assert.equal(s.span, "L2-L2");
  assert.equal(s.body_text, "Demo & Co");
});

const POM = [
  "<project>",                                  //  1
  "  <modelVersion>4.0.0</modelVersion>",      //  2
  "  <parent>",                                 //  3
  "    <groupId>org.x</groupId>",              //  4
  "    <artifactId>par</artifactId>",          //  5
  "    <version>1</version>",                  //  6
  "  </parent>",                                //  7
  "  <modules>",                                //  8
  "    <module>core</module>",                 //  9
  "  </modules>",                               // 10
  "  <dependencies>",                           // 11
  "    <dependency>",                           // 12
  "      <groupId>junit</groupId>",            // 13
  "      <artifactId>junit</artifactId>",      // 14
  "      <version>4.13</version>",             // 15
  "    </dependency>",                          // 16
  "  </dependencies>",                          // 17
  "  <profiles><profile><id>ci</id></profile></profiles>", // 18
  "</project>",                                 // 19
];

test("xml: a pom's parent, modules, dependencies and profiles are named by coordinates", () => {
  assert.deepEqual(spans(doc(POM), "pom.xml"), {
    "parent:org.x:par": "L3-L7",
    "module:core": "L9-L9",
    "dependency:junit:junit": "L12-L16",
    "profile:ci": "L18-L18",
  });
  const dep = byName(parse(doc(POM), "pom.xml").nodes, "dependency:junit:junit");
  assert.equal(dep.signature, "dependency:junit:junit:4.13");
});

const PLIST = [
  '<?xml version="1.0" encoding="UTF-8"?>',   //  1
  '<plist version="1.0">',                     //  2
  "<dict>",                                    //  3
  "  <key>CFBundleName</key>",                //  4
  "  <string>Demo</string>",                  //  5
  "  <key>NSAppTransportSecurity</key>",      //  6
  "  <dict>",                                  //  7
  "    <key>NSAllowsArbitraryLoads</key>",    //  8
  "    <true/>",                               //  9
  "  </dict>",                                 // 10
  "  <key>apiToken</key>",                    // 11
  "  <string>abc</string>",                   // 12
  "</dict>",                                   // 13
  "</plist>",                                  // 14
];

test("xml: a property list's keys get dotted paths, values and the secret rule", () => {
  const nodes = parse(doc(PLIST), "Info.plist").nodes;
  assert.deepEqual(
    nodes.filter((n) => n.kind === "key").map((n) => [n.name, n.span]),
    [
      ["CFBundleName", "L4-L5"],
      ["NSAppTransportSecurity", "L6-L10"],
      ["NSAppTransportSecurity.NSAllowsArbitraryLoads", "L8-L9"],
      ["apiToken", "L11-L12"],
    ],
  );
  assert.equal(byName(nodes, "CFBundleName").body_text, "Demo");
  assert.equal(byName(nodes, "NSAppTransportSecurity.NSAllowsArbitraryLoads").body_text, "true");
  assert.equal(byName(nodes, "apiToken").body_text, undefined);
  assert.equal(byName(nodes, "apiToken").signature, "apiToken");
});

test("xml: a storyboard contributes scenes and controllers, never the view tree", () => {
  const sb = [
    '<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB">', // 1
    "  <scenes>",                                                               // 2
    '    <scene sceneID="abc">',                                                // 3
    "      <objects>",                                                          // 4
    '        <viewController id="vc1" storyboardIdentifier="Main">',            // 5
    '          <view id="v1" key="view"/>',                                     // 6
    "        </viewController>",                                                // 7
    "      </objects>",                                                         // 8
    "    </scene>",                                                             // 9
    "  </scenes>",                                                              // 10
    "</document>",                                                              // 11
  ];
  assert.deepEqual(spans(doc(sb), "Main.storyboard"), { "scene#abc": "L3-L9", "viewController#Main": "L5-L7" });
});

test("xml: CRLF, a BOM, entities, mismatched tags and garbage never break or misplace anything", () => {
  assert.equal(spans(doc(MANIFEST, "\r\n"), "AndroidManifest.xml")["activity[name=.Main]"], "L5-L9");
  assert.equal(spans("﻿" + doc(MANIFEST), "AndroidManifest.xml")["activity[name=.Main]"], "L5-L9");
  assert.deepEqual(spans(doc(['<a id="x">', '  <b id="y">', "</a>"]), "m.xml"), { "a#x": "L1-L3", "b#y": "L2-L3" });
  assert.equal(parse("<<< not xml >>>", "x.xml").nodes[0]!.kind, "file");
  assert.deepEqual(parse("", "x.xml").nodes.map((n) => n.kind), ["file"]);
  assert.deepEqual(spans(doc(["<!-- <a id='no'/> -->", "<r><![CDATA[ <b id='no'/> ]]><c id='yes'/></r>"]), "c.xml"), { "c#yes": "L2-L2" });
});

test("xml: a manifest, a pom and a plist go through a real build and check as in sync", async () => {
  const dir = tmpRepo("structured-xml");
  mkdirSync(join(dir, "app"), { recursive: true });
  writeFileSync(join(dir, "app", "AndroidManifest.xml"), doc(MANIFEST));
  writeFileSync(join(dir, "pom.xml"), doc(POM));
  writeFileSync(join(dir, "Info.plist"), doc(PLIST));
  patchBuildConfig(dir, { structured: true });
  const outDir = join(dir, "graft");
  await buildGraph(dir, { contextDir: outDir, reuse: false });
  const graph = readGraph(wiringPath(outDir));
  assert.equal(graph.nodes.find((n) => n.id === "app/AndroidManifest.xml#element:activity[name=.Main]")?.span, "L5-L9");
  assert.equal(graph.nodes.find((n) => n.id === "pom.xml#element:dependency:junit:junit")?.span, "L12-L16");
  assert.equal(graph.nodes.find((n) => n.id === "Info.plist#key:CFBundleName")?.span, "L4-L5");
  assert.equal(graph.nodes.find((n) => n.id === "Info.plist#key:apiToken")?.body_text, undefined);
  const check = await checkGraph(dir, { contextDir: outDir });
  assert.equal(check.ok, true, `check must be clean, got ${JSON.stringify(check)}`);
});
