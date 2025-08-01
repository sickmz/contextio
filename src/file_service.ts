import * as vscode from "vscode";
import * as path from "path";
import { SearchResult } from "./types";

export class file_service {
  constructor(private readonly extension_uri: vscode.Uri) {}

  public async searchFiles(query: string): Promise<SearchResult[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const results: SearchResult[] = [];
    const search_pattern = `**/*${query}*`;

    try {
      const uris = await vscode.workspace.findFiles(
        search_pattern,
        "**/node_modules/**",
        100
      );

      for (const uri of uris) {
        const filename = path.basename(uri.fsPath);
        const directory = path.dirname(uri.fsPath);
        const relative_dir = this.getRelativeDirectory(uri);

        results.push({
          filename: filename,
          directory: relative_dir,
          resource: uri.toString(),
        });
      }
    } catch (error) {}

    return results;
  }

  public async readWorkspaceFiles(): Promise<vscode.Uri[]> {
    const open_tabs = vscode.window.tabGroups.all
      .flatMap((group) => group.tabs.map((tab) => tab.input))
      .filter(
        (input): input is vscode.TabInputText =>
          input instanceof vscode.TabInputText && input.uri.scheme === "file"
      );

    return open_tabs.map((tab_input) => tab_input.uri);
  }

  private getRelativeDirectory(uri: vscode.Uri): string {
    const workspace_folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspace_folder) {
      return path.dirname(uri.fsPath);
    }

    const relative_path = path.relative(
      workspace_folder.uri.fsPath,
      path.dirname(uri.fsPath)
    );
    return relative_path || ".";
  }
}
