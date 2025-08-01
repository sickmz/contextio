import * as vscode from "vscode";

export interface SearchResult {
  filename: string;
  directory: string;
  resource: string;
}

export interface SummaryData {
  total_files: number;
  total_chars: number;
  total_tokens: number;
}

export interface ContextFile {
  uri: vscode.Uri;
  path: string;
}
