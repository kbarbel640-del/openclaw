/**
 * Notion API property formatting helpers for DJ skill operations.
 */

export type NotionRichText = {
  type: "text";
  text: { content: string };
};

export type NotionTitle = {
  title: NotionRichText[];
};

export type NotionSelect = {
  select: { name: string };
};

export type NotionMultiSelect = {
  multi_select: Array<{ name: string }>;
};

export type NotionDate = {
  date: { start: string; end?: string } | null;
};

export type NotionCheckbox = {
  checkbox: boolean;
};

export type NotionNumber = {
  number: number | null;
};

export type NotionUrl = {
  url: string | null;
};

/**
 * Format a string as Notion title property.
 */
export function formatNotionTitle(text: string): NotionTitle {
  return {
    title: [{ type: "text", text: { content: text } }],
  };
}

/**
 * Format a string as Notion rich_text property.
 */
export function formatNotionRichText(text: string): { rich_text: NotionRichText[] } {
  return {
    rich_text: [{ type: "text", text: { content: text } }],
  };
}

/**
 * Format a string as Notion select property.
 */
export function formatNotionSelect(value: string): NotionSelect {
  return {
    select: { name: value },
  };
}

/**
 * Format an array of strings as Notion multi_select property.
 */
export function formatNotionMultiSelect(values: string[]): NotionMultiSelect {
  return {
    multi_select: values.map((name) => ({ name })),
  };
}

/**
 * Format a date string (ISO 8601) as Notion date property.
 */
export function formatNotionDate(start: string, end?: string): NotionDate {
  return {
    date: { start, ...(end ? { end } : {}) },
  };
}

/**
 * Format a boolean as Notion checkbox property.
 */
export function formatNotionCheckbox(value: boolean): NotionCheckbox {
  return {
    checkbox: value,
  };
}

/**
 * Format a number as Notion number property.
 */
export function formatNotionNumber(value: number | null): NotionNumber {
  return {
    number: value,
  };
}

/**
 * Format a URL string as Notion url property.
 */
export function formatNotionUrl(url: string | null): NotionUrl {
  return {
    url,
  };
}

/**
 * Build a Notion page creation payload for a task.
 */
export function buildTaskPagePayload(params: {
  databaseId: string;
  name: string;
  status?: string;
  priority?: string;
  due?: string;
  source?: string;
  estimate?: number;
  notes?: string;
}): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    Name: formatNotionTitle(params.name),
  };

  if (params.status) {
    properties.Status = formatNotionSelect(params.status);
  }

  if (params.priority) {
    properties.Priority = formatNotionSelect(params.priority);
  }

  if (params.due) {
    properties.Due = formatNotionDate(params.due);
  }

  if (params.source) {
    properties.Source = formatNotionSelect(params.source);
  }

  if (params.estimate !== undefined) {
    properties.Estimate = formatNotionNumber(params.estimate);
  }

  if (params.notes) {
    properties.Notes = formatNotionRichText(params.notes);
  }

  return {
    parent: { database_id: params.databaseId },
    properties,
  };
}

/**
 * Build a Notion paragraph block.
 */
export function buildParagraphBlock(text: string): Record<string, unknown> {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  };
}

/**
 * Build a Notion query filter for tasks due in a date range.
 */
export function buildTasksDueDateFilter(params: {
  startDate: string;
  endDate: string;
  excludeDone?: boolean;
}): Record<string, unknown> {
  const filters: Record<string, unknown>[] = [
    { property: "Due", date: { on_or_after: params.startDate } },
    { property: "Due", date: { on_or_before: params.endDate } },
  ];

  if (params.excludeDone !== false) {
    filters.push({ property: "Status", select: { does_not_equal: "Done" } });
  }

  return {
    filter: { and: filters },
    sorts: [{ property: "Due", direction: "ascending" }],
  };
}
