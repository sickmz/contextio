import * as vscode from "vscode";
import * as path from "path";
import { ContextFile, SummaryData } from "./types";

export class context_manager {
  private context_files = new Set<string>();
  private file_cache = new Map<string, string>();

  constructor(private readonly extension_uri: vscode.Uri) {}

  public addFile(file_uri: vscode.Uri): boolean {
    const uri_string = file_uri.toString();
    if (this.context_files.has(uri_string)) {
      return false;
    }
    this.context_files.add(uri_string);
    return true;
  }

  public removeFile(file_uri: vscode.Uri): boolean {
    const uri_string = file_uri.toString();
    this.file_cache.delete(uri_string);
    return this.context_files.delete(uri_string);
  }

  public clearContext(): void {
    this.context_files.clear();
    this.file_cache.clear();
  }

  public getContext(): ContextFile[] {
    return Array.from(this.context_files).map((uri_str) => {
      const uri = vscode.Uri.parse(uri_str);
      return {
        uri: uri,
        path: this.getRelativePath(uri),
      };
    });
  }

  public getContextSize(): number {
    return this.context_files.size;
  }

  public async getSummary(): Promise<SummaryData> {
    let total_chars = 0;
    const total_files = this.context_files.size;
    const file_uris = Array.from(this.context_files).map((uri_str) =>
      vscode.Uri.parse(uri_str)
    );

    for (const file_uri of file_uris) {
      try {
        const content = await this.readFileContent(file_uri);
        total_chars += content.length;
      } catch (error) {}
    }

    const total_tokens = Math.ceil(total_chars / 4);
    return {
      total_files: total_files,
      total_chars: total_chars,
      total_tokens: total_tokens,
    };
  }

  public async readFileContent(file_uri: vscode.Uri): Promise<string> {
    const uri_string = file_uri.toString();

    if (this.file_cache.has(uri_string)) {
      return this.file_cache.get(uri_string)!;
    }

    try {
      const content_bytes = await vscode.workspace.fs.readFile(file_uri);
      const content = Buffer.from(content_bytes).toString("utf8");
      this.file_cache.set(uri_string, content);
      return content;
    } catch (error) {
      throw error;
    }
  }

  public clearCache(): void {
    this.file_cache.clear();
  }

  private getRelativePath(uri: vscode.Uri): string {
    const workspace_folder = vscode.workspace.getWorkspaceFolder(uri);
    return workspace_folder
      ? path.relative(workspace_folder.uri.fsPath, uri.fsPath)
      : uri.fsPath;
  }
}
