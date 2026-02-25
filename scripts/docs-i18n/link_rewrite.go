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
func rewriteInternalLinks(content, locale string) string {
	if locale == "" || locale == "en" {
		return content
	}
	prefix := "/" + locale + "/"

	content = mdInternalLinkRe.ReplaceAllStringFunc(content, func(match string) string {
		path := match[2 : len(match)-1] // strip ]( and )
		if skipLinkRewrite(path, locale) {
			return match
		}
		return "](" + prefix + path[1:] + ")"
	})

	content = hrefInternalRe.ReplaceAllStringFunc(content, func(match string) string {
		path := match[6 : len(match)-1] // strip href=" and "
		if skipLinkRewrite(path, locale) {
			return match
		}
		return `href="` + prefix + path[1:] + `"`
	})

	return content
}

func skipLinkRewrite(path, locale string) bool {
	if strings.HasPrefix(path, "/"+locale+"/") {
		return true
	}
	// shared static resources live at docs root, not per-locale
	if strings.HasPrefix(path, "/assets/") || strings.HasPrefix(path, "/images/") {
		return true
	}
	return false
}

// fixLinksInDir rewrites internal links in all existing translated .md files.
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
		rewritten := rewriteInternalLinks(string(content), locale)
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
