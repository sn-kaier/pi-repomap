import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractMarkdownTags } from "../../src/tree-sitter/markdown.ts";

describe("Markdown tag extraction", () => {
  it("extracts ATX headings at all levels", () => {
    const code = `# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6`;
    const tags = extractMarkdownTags(code, "test.md", "/abs/test.md");
    const headings = tags.filter((t) => t.kind === "def" && t.kindDetail === "heading");

    assert.equal(headings.length, 6);
    assert.equal(headings[0].name, "Heading 1");
    assert.equal(headings[0].returnType, "h1");
    assert.equal(headings[0].line, 0);

    assert.equal(headings[1].name, "Heading 2");
    assert.equal(headings[1].returnType, "h2");
    assert.equal(headings[1].line, 1);

    assert.equal(headings[5].name, "Heading 6");
    assert.equal(headings[5].returnType, "h6");
    assert.equal(headings[5].line, 5);
  });

  it("handles headings with trailing hashes", () => {
    const code = `# Heading 1 ###
## Heading 2 ##`;
    const tags = extractMarkdownTags(code, "test.md", "/abs/test.md");
    const headings = tags.filter((t) => t.kind === "def" && t.kindDetail === "heading");

    assert.equal(headings.length, 2);
    assert.equal(headings[0].name, "Heading 1");
    assert.equal(headings[1].name, "Heading 2");
  });

  it("extracts setext headings (h1 with ===)", () => {
    const code = `Heading 1
=========`;
    const tags = extractMarkdownTags(code, "test.md", "/abs/test.md");
    const headings = tags.filter((t) => t.kind === "def" && t.kindDetail === "heading");

    assert.equal(headings.length, 1);
    assert.equal(headings[0].name, "Heading 1");
    assert.equal(headings[0].returnType, "h1");
    assert.equal(headings[0].line, 0);
  });

  it("extracts setext headings (h2 with ---)", () => {
    const code = `Heading 2
---------`;
    const tags = extractMarkdownTags(code, "test.md", "/abs/test.md");
    const headings = tags.filter((t) => t.kind === "def" && t.kindDetail === "heading");

    assert.equal(headings.length, 1);
    assert.equal(headings[0].name, "Heading 2");
    assert.equal(headings[0].returnType, "h2");
    assert.equal(headings[0].line, 0);
  });

  it("does not confuse thematic break --- with setext heading", () => {
    const code = `Some text

---

More text`;
    const tags = extractMarkdownTags(code, "test.md", "/abs/test.md");
    const headings = tags.filter((t) => t.kind === "def" && t.kindDetail === "heading");
    // The "---" on its own line with no preceding text above should NOT be a heading
    assert.equal(headings.length, 0);
  });

  it("does not confuse list item --- with setext heading", () => {
    const code = `- item 1
- item 2`;
    const tags = extractMarkdownTags(code, "test.md", "/abs/test.md");
    const headings = tags.filter((t) => t.kind === "def" && t.kindDetail === "heading");
    assert.equal(headings.length, 0);
  });

  it("extracts YAML frontmatter keys", () => {
    const code = `---
name: scout
description: Fast codebase recon
tools: read, grep, find, ls, bash
thinking: low
---`;
    const tags = extractMarkdownTags(code, "test.md", "/abs/test.md");
    const fields = tags.filter((t) => t.kind === "def" && t.kindDetail === "field");

    assert.equal(fields.length, 4);
    assert.equal(fields[0].name, "name");
    assert.equal(fields[0].returnType, "scout");
    assert.equal(fields[1].name, "description");
    assert.equal(fields[1].returnType, "Fast codebase recon");
  });

  it("processes frontmatter when file starts with ---", () => {
    const code = `---
name: scout
---`;
    // First line IS ---, so this IS frontmatter
    const tags = extractMarkdownTags(code, "test.md", "/abs/test.md");
    const fields = tags.filter((t) => t.kind === "def" && t.kindDetail === "field");
    assert.equal(fields.length, 1);
  });

  it("does not treat mid-file --- as frontmatter", () => {
    const code = `# Heading

---
some content`;
    const tags = extractMarkdownTags(code, "test.md", "/abs/test.md");
    const fields = tags.filter((t) => t.kind === "def" && t.kindDetail === "field");
    assert.equal(fields.length, 0);
  });

  it("extracts fenced code blocks with language", () => {
    const code = `Some text

\`\`\`typescript
const x: number = 1;
\`\`\`

\`\`\`python
def hello():
    pass
\`\`\``;
    const tags = extractMarkdownTags(code, "test.md", "/abs/test.md");
    const codeblocks = tags.filter((t) => t.kind === "def" && t.kindDetail === "codeblock");

    assert.equal(codeblocks.length, 2);
    assert.equal(codeblocks[0].name, "typescript");
    assert.equal(codeblocks[1].name, "python");
  });

  it("extracts code blocks without language as 'text'", () => {
    const code = `\`\`\`
plain code
\`\`\``;
    const tags = extractMarkdownTags(code, "test.md", "/abs/test.md");
    const codeblocks = tags.filter((t) => t.kind === "def" && t.kindDetail === "codeblock");

    assert.equal(codeblocks.length, 1);
    assert.equal(codeblocks[0].name, "text");
  });

  it("handles tilde-fenced code blocks", () => {
    const code = `~~~bash
echo hello
~~~`;
    const tags = extractMarkdownTags(code, "test.md", "/abs/test.md");
    const codeblocks = tags.filter((t) => t.kind === "def" && t.kindDetail === "codeblock");

    assert.equal(codeblocks.length, 1);
    assert.equal(codeblocks[0].name, "bash");
  });

  it("extracts GitHub-Flavored Markdown callouts", () => {
    const code = `> [!NOTE]
> This is a note

> [!WARNING]
> This is a warning

> [!TIP]
> Helpful tip`;
    const tags = extractMarkdownTags(code, "test.md", "/abs/test.md");
    const callouts = tags.filter((t) => t.kind === "def" && t.kindDetail === "callout");

    assert.equal(callouts.length, 3);
    assert.equal(callouts[0].name, "NOTE");
    assert.equal(callouts[1].name, "WARNING");
    assert.equal(callouts[2].name, "TIP");
  });

  it("extracts legacy bold-label callouts", () => {
    const code = `> **Note:** This is a note

> **Warning:** Be careful

> **TODO:** Fix this later`;
    const tags = extractMarkdownTags(code, "test.md", "/abs/test.md");
    const callouts = tags.filter((t) => t.kind === "def" && t.kindDetail === "callout");

    assert.equal(callouts.length, 3);
    assert.equal(callouts[0].name, "Note");
    assert.equal(callouts[1].name, "Warning");
    assert.equal(callouts[2].name, "TODO");
  });

  it("extracts wikilinks as references", () => {
    const code = `See [[scout]] and [[worker.md]] for details.`;
    const tags = extractMarkdownTags(code, "docs/index.md", "/abs/docs/index.md");
    const refs = tags.filter((t) => t.kind === "ref" && t.kindDetail === "wikilink");

    assert.equal(refs.length, 2);
    assert.equal(refs[0].name, "scout");  // resolved from [[scout]]
    assert.equal(refs[1].name, "worker"); // resolved from [[worker.md]]
  });

  it("extracts inline links to local .md files as references", () => {
    const code = `Read the [scout guide](../agents/scout.md) and [worker docs](./worker.md).`;
    const tags = extractMarkdownTags(code, "docs/index.md", "/abs/docs/index.md");
    const refs = tags.filter((t) => t.kind === "ref" && t.kindDetail === "link");

    assert.equal(refs.length, 2);
    // ../agents/scout.md resolved against docs/index.md → agents/scout.md → stem "scout"
    assert.equal(refs[0].name, "scout");
    // ./worker.md resolved against docs/index.md → docs/worker.md → stem "worker"
    assert.equal(refs[1].name, "worker");
  });

  it("extracts reference-style links to .md files", () => {
    const code = `[scout]: ./scout.md
[worker]: ../agents/worker.md`;
    const tags = extractMarkdownTags(code, "docs/index.md", "/abs/docs/index.md");
    const refs = tags.filter((t) => t.kind === "ref" && t.kindDetail === "linkref");

    assert.equal(refs.length, 2);
    assert.equal(refs[0].name, "scout");
    assert.equal(refs[1].name, "worker");
  });

  it("ignores links to non-md files", () => {
    const code = `See the [image](image.png) and [site](https://example.com).`;
    const tags = extractMarkdownTags(code, "test.md", "/abs/test.md");
    const refs = tags.filter((t) => t.kind === "ref");
    assert.equal(refs.length, 0);
  });

  it("handles a realistic agent file with frontmatter and content", () => {
    const code = `---
name: scout
description: Fast codebase recon that returns compressed context for handoff
tools: read, grep, find, ls, bash, write, intercom
thinking: low
---

# Overview

You are a scouting subagent.

## Focus

Focus on the minimum context:

- entry points
- key types

> [!NOTE]
> Use grep and find first.

See [[worker]] for implementation details.`;
    const tags = extractMarkdownTags(code, "agents/scout.md", "/abs/agents/scout.md");

    const fields = tags.filter((t) => t.kind === "def" && t.kindDetail === "field");
    assert.equal(fields.length, 4);
    assert.ok(fields.some((t) => t.name === "name"));
    assert.ok(fields.some((t) => t.name === "description"));
    assert.ok(fields.some((t) => t.name === "tools"));
    assert.ok(fields.some((t) => t.name === "thinking"));

    const headings = tags.filter((t) => t.kind === "def" && t.kindDetail === "heading");
    assert.equal(headings.length, 2);
    assert.equal(headings[0].name, "Overview");
    assert.equal(headings[0].returnType, "h1");
    assert.equal(headings[1].name, "Focus");
    assert.equal(headings[1].returnType, "h2");

    const callouts = tags.filter((t) => t.kind === "def" && t.kindDetail === "callout");
    assert.equal(callouts.length, 1);
    assert.equal(callouts[0].name, "NOTE");

    const refs = tags.filter((t) => t.kind === "ref");
    assert.equal(refs.length, 1);
    assert.equal(refs[0].name, "worker");
  });

  it("emits tags for unclosed code fences at EOF", () => {
    const code = "```python\nprint('hello')";
    const tags = extractMarkdownTags(code, "test.md", "/abs/test.md");
    const codeblocks = tags.filter((t) => t.kind === "def" && t.kindDetail === "codeblock");

    assert.equal(codeblocks.length, 1);
    assert.equal(codeblocks[0].name, "python");
  });

  it("returns empty array for empty content", () => {
    const tags = extractMarkdownTags("", "empty.md", "/abs/empty.md");
    assert.equal(tags.length, 0);
  });

  it("returns empty array for content with no structural elements", () => {
    const code = "Just a plain paragraph with no markdown structure.\n\nAnother paragraph.";
    const tags = extractMarkdownTags(code, "plain.md", "/abs/plain.md");
    assert.equal(tags.length, 0);
  });

  it("correctly reports line numbers", () => {
    const code = `Line 1
Line 2
# Heading at line 3
Line 4
## Subheading at line 5`;
    const tags = extractMarkdownTags(code, "test.md", "/abs/test.md");
    const headings = tags.filter((t) => t.kind === "def" && t.kindDetail === "heading");

    assert.equal(headings.length, 2);
    assert.equal(headings[0].line, 2); // 0-indexed: line 3
    assert.equal(headings[0].name, "Heading at line 3");
    assert.equal(headings[1].line, 4); // 0-indexed: line 5
    assert.equal(headings[1].name, "Subheading at line 5");
  });
});
