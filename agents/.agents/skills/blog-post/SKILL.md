---
name: blog-post
description: Draft a post for JC's blog (jczhang.cc, repo ~/dev/blog) from any working directory, usually about the current project, in JC's research-writing voice. Use when asked to write something up as a blog post (博客, 写成博客, blog post), or to revise a draft post.
---

# Blog post

The blog is an Astro site in `~/dev/blog`. A post is one folder, `src/content/posts/<slug>/`, holding `zh.md` and/or `en.md` and the post's images and videos. Your work ends at a **draft** in that folder; JC reviews, commits and publishes.

## Steps

1. **Read the syntax.** Read `~/dev/blog/WRITING.md` in full: it is the single source of truth for frontmatter, sections, math, theorems, citations, figures, tables, TikZ, video and footnotes (footnotes show as sidenotes). `src/content/posts/hello-math/zh.md` uses every feature. Done when you know how to write each element the post needs.

2. **Collect the facts** from the current project: problem, method, results with numbers, figures, limitations, and the papers it builds on. Write them down as a plain list, each traced to a file, a result or JC's words. Done when every claim the post will make is on the list; ask JC for missing key facts, and mark the rest `[TODO: ...]` in the draft.

3. **Load the voice.** Invoke the `jc-writing-style` skill and use its *paper* genre (`paper.md`): the blog is written as a research paper section is. The post's language follows JC's request; Chinese is the default (`zh.md`), and an English version is `en.md` in the same folder, rewritten for the language, not translated sentence by sentence.

4. **Create the post.** In `~/dev/blog`: `bun run new <slug>` (add `--en` for `en.md`). The slug is short, lowercase, hyphenated English (`fno-burgers`). Fill the frontmatter: `title`, `description` (one or two sentences, shown as the abstract), `tags` (reuse existing ones: `grep -h '^tags:' src/content/posts/*/*.md`), and keep `draft: true`.

5. **Bring the assets.** Copy figures and videos into the post folder and link them relatively (`![...](./fig.png)`); the post must not point into the project directory. Prefer SVG for line art and PNG under about 2 MB for plots. A video over 25 MiB needs `bun run media:push` (it uploads to R2): leave that to JC and say so in the report.

6. **Add the citations.** Every `\cite{key}` needs a BibTeX entry in `src/bibliography.bib` (the files are listed under `bibliography` in `lemma.config.mjs`). Reuse an entry that is already there; otherwise add one with correct metadata (from the publisher, DOI or arXiv page), and a key in the style of the others.

7. **Check the build.** Run `bun run build` in `~/dev/blog` (drafts are not published, but they are rendered and checked). Done when the output has no `[mathjax]`, `[cite]`, `[theorems]`, `[tikz]` or `[media]` line for your post. To look at the page, use the dev server if one is running (`bunx astro dev status` gives its URL; drafts appear at `/posts/<slug>/`); one project allows only one dev server, so do not start a second.

8. **Report** to JC: the folder path, the preview URL (if a dev server runs), the open `[TODO]`s, and any step left to JC (large videos, missing facts).

## Scope

Write only inside `src/content/posts/<slug>/`, plus the generated `tikz-cache/` files and `src/bibliography.bib` entries your post needs. The site's code, styles and other posts stay as they are; ask JC if the post seems to need a new feature. JC commits and deploys (`bun run deploy`) after reviewing, so leave git and deployment untouched.

Do not open or change the About page content (`src/content/about/`) unless JC asks; see `~/dev/blog/AGENTS.md`.
