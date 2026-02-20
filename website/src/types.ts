export interface ContentBlock {
  type: string;
}

export interface TextBlock extends ContentBlock {
  type: "text";
  text: string;
}

export interface HeadingBlock extends ContentBlock {
  type: "heading";
  level: number;
  text: string;
}

export interface DiagramBlock extends ContentBlock {
  type: "diagram";
  index: number;
  description: string;
  labels?: string[];
  bbox?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export interface CautionBlock extends ContentBlock {
  type: "caution";
  text: string;
}

export interface NoticeBlock extends ContentBlock {
  type: "notice";
  text: string;
}

export interface TableBlock extends ContentBlock {
  type: "table";
  caption?: string;
  headers: string[];
  rows: string[][];
}

export interface ListBlock extends ContentBlock {
  type: "list";
  ordered: boolean;
  items: string[];
}

export interface TorqueSpecBlock extends ContentBlock {
  type: "torque_spec";
  component: string;
  value: string;
}

export interface PartNumberBlock extends ContentBlock {
  type: "part_number";
  label: string;
  number: string;
  description?: string;
}

export type ManualContentBlock =
  | TextBlock
  | HeadingBlock
  | DiagramBlock
  | CautionBlock
  | NoticeBlock
  | TableBlock
  | ListBlock
  | TorqueSpecBlock
  | PartNumberBlock;

export interface PageData {
  page_id: string;
  section_header: string;
  title: string;
  ocr_text?: string;
  content?: ManualContentBlock[];
}

export interface SectionPageInfo {
  page: number;
  title: string;
  section_header: string;
}

export interface SectionInfo {
  code: string;
  name: string;
  pages: number;
  page_index: SectionPageInfo[];
}

export interface SearchEntry {
  section: string;
  page: number;
  title: string;
  section_header: string;
  text: string;
}

export interface SearchResult {
  id: number;
  section: string;
  page: number;
  title: string;
  section_header: string;
  section_name: string;
  content_text: string;
  score: number;
}

export interface SearchResponse {
  results: SearchResult[];
  error?: string;
}
