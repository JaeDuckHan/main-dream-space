import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";
import { z } from "zod";

export const communityCategorySchema = z.enum(["notice", "question", "review", "info"]);
export const coffeeChatStatusSchema = z.enum(["open", "full", "cancelled", "completed"]);
export const stayTypeSchema = z.enum(["monthly_stay", "long_term", "retirement", "workation"]);
export const reportTargetSchema = z.enum(["post", "comment", "user"]);
export const reportReasonSchema = z.enum(["spam", "abuse", "inappropriate", "other"]);

const SAFE_TAGS = [
  "a",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
] as const;

const SAFE_ATTR = ["alt", "class", "href", "rel", "src", "target", "title"] as const;

marked.setOptions({
  gfm: true,
  breaks: true,
});

export function renderMarkdownHtml(content: string) {
  const rawHtml = marked.parse(content) as string;
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [...SAFE_TAGS],
    ALLOWED_ATTR: [...SAFE_ATTR],
  });
}

export function extractImageUrls(content: string) {
  const matches = content.matchAll(/!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g);
  return [...new Set([...matches].map((match) => match[1]).filter(Boolean))];
}

export function buildResidentActiveWhere(activeOnly: boolean, alias = "r") {
  const prefix = alias ? `${alias}.` : "";
  if (!activeOnly) {
    return `${prefix}is_public = TRUE`;
  }

  return `${prefix}is_public = TRUE
    AND ${prefix}stay_from <= CURRENT_DATE
    AND (${prefix}stay_to IS NULL OR ${prefix}stay_to >= CURRENT_DATE)`;
}
