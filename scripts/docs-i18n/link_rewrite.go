package main

import (
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var (
	// ](/path...) — internal markdown links starting with /
	mdInternalLinkRe = regexp.MustCompile(`\]\(/([^)]*)\)`)
	// href="/path..." — internal HTML href attributes starting with /
	hrefInternalRe = regexp.MustCompile(`href="/([^"]*)"`)
)

// rewriteInternalLinks prefixes internal doc links with the target locale
// (e.g. ](/start/wizard) → ](/zh-CN/start/wizard)).
// When docsRoot is non-empty, only prefixes links whose target page exists
// in the locale directory (handles partially-translated locales like ja-JP).
func rewriteInternalLinks(content, locale, docsRoot string) string {
	if locale == "" || locale == "en" {
		return content
	}
	prefix := "/" + locale + "/"

	content = mdInternalLinkRe.ReplaceAllStringFunc(content, func(match string) string {
		path := match[2 : len(match)-1]
		if skipLinkRewrite(path, locale, docsRoot) {
			return match
		}
		return "](" + prefix + path[1:] + ")"
	})

	content = hrefInternalRe.ReplaceAllStringFunc(content, func(match string) string {
		path := match[6 : len(match)-1]
		if skipLinkRewrite(path, locale, docsRoot) {
			return match
		}
		return `href="` + prefix + path[1:] + `"`
	})

	return content
}

func skipLinkRewrite(path, locale, docsRoot string) bool {
	if strings.HasPrefix(path, "/"+locale+"/") {
		return true
	}
	if strings.HasPrefix(path, "/assets/") || strings.HasPrefix(path, "/images/") {
		return true
	}
	if docsRoot != "" && !localePageExists(docsRoot, locale, path) {
		return true
	}
	return false
}

// localePageExists checks whether the linked page has a translated version.
func localePageExists(docsRoot, locale, linkPath string) bool {
	p := linkPath
	if idx := strings.Index(p, "#"); idx >= 0 {
		p = p[:idx]
	}
	p = strings.TrimPrefix(p, "/")
	if p == "" {
		return false
	}
	for _, ext := range []string{".md", ".mdx"} {
		if _, err := os.Stat(filepath.Join(docsRoot, locale, p+ext)); err == nil {
			return true
		}
	}
	if _, err := os.Stat(filepath.Join(docsRoot, locale, p, "index.md")); err == nil {
		return true
	}
	return false
}

// fixLinksInDir rewrites internal links in all existing translated .md files,
// only prefixing links whose target page exists in the locale.
func fixLinksInDir(docsRoot, locale string) (int, error) {
	targetDir := filepath.Join(docsRoot, locale)
	fixed := 0
	err := filepath.Walk(targetDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() || !strings.HasSuffix(path, ".md") {
			return nil
		}
		content, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		rewritten := rewriteInternalLinks(string(content), locale, docsRoot)
		if rewritten != string(content) {
			if err := os.WriteFile(path, []byte(rewritten), 0o644); err != nil {
				return err
			}
			relPath, _ := filepath.Rel(docsRoot, path)
			log.Printf("docs-i18n: fixed links in %s", relPath)
			fixed++
		}
		return nil
	})
	return fixed, err
}
