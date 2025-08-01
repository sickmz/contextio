import * as vscode from "vscode";
import { context_manager } from "./context_manager";
import { file_service } from "./file_service";

export class message_handler {
  constructor(
    private readonly context_mgr: context_manager,
    private readonly file_svc: file_service,
    private readonly post_message: (message: any) => Thenable<boolean>
  ) {}

  public async handleMessage(data: any): Promise<void> {
    const handlers: { [key: string]: (data: any) => Promise<void> } = {
      searchFiles: (data) => this.handleSearchFiles(data),
      addFile: (data) => this.handleAddFile(data),
      addMultipleFiles: (data) => this.handleAddMultipleFiles(data),
      removeFile: (data) => this.handleRemoveFile(data),
      addDroppedFiles: (data) => this.handleAddDroppedFiles(data),
      addOpenFiles: () => this.handleaddOpenFiles(),
      exportContext: () => this.handleexportContext(),
      clearContext: () => this.handleclearContext(),
      copySummary: () => this.handleCopySummary(),
    };

    const handler = handlers[data.type];
    if (handler) {
      await handler(data);
    }
  }

  private async handleSearchFiles(data: any): Promise<void> {
    const results = data.value
      ? await this.file_svc.searchFiles(data.value)
      : [];
    const grouped_results: { [directory: string]: any[] } = {};

    results.forEach((result) => {
      if (!grouped_results[result.directory]) {
        grouped_results[result.directory] = [];
      }
      grouped_results[result.directory].push(result);
    });

    await this.post_message({ type: "searchResults", files: grouped_results });
  }

  private async handleAddFile(data: any): Promise<void> {
    const uri = vscode.Uri.parse(data.value);
    this.context_mgr.addFile(uri);
    await this.updateContextView();
  }

  private async handleAddMultipleFiles(data: any): Promise<void> {
    if (data.value && Array.isArray(data.value)) {
      data.value.forEach((uri_str: string) => {
        const uri = vscode.Uri.parse(uri_str);
        this.context_mgr.addFile(uri);
      });
      await this.updateContextView();
    }
  }

  private async handleRemoveFile(data: any): Promise<void> {
    const uri = vscode.Uri.parse(data.value);
    this.context_mgr.removeFile(uri);
    await this.updateContextView();
  }

  private async handleAddDroppedFiles(data: any): Promise<void> {
    if (data.value && Array.isArray(data.value)) {
      data.value
        .map((uri_str: string) => vscode.Uri.parse(uri_str))
        .forEach((uri: vscode.Uri) => this.context_mgr.addFile(uri));
      await this.updateContextView();
    }
  }

  private async handleaddOpenFiles(): Promise<void> {
    const open_files = await this.file_svc.readWorkspaceFiles();
    open_files.forEach((uri) => this.context_mgr.addFile(uri));
    await this.updateContextView();
  }

  private async handleexportContext(): Promise<void> {
    if (this.context_mgr.getContextSize() === 0) {
      vscode.window.showWarningMessage("No files in context to export.");
      return;
    }

    const preamble = await vscode.window.showInputBox({
      prompt: "Enter a preamble message for the context",
      placeHolder: "Preamble message...",
    });

    if (preamble === undefined) {
      return;
    }

    const content_lines: string[] = [preamble, ""];
    const context_files = this.context_mgr.getContext();

    content_lines.push(
      `=== Summary ===`,
      `Total files: ${context_files.length}`,
      `File titles:`
    );

    context_files.forEach((file) => {
      content_lines.push(`- ${file.path}`);
    });
    content_lines.push("\n");

    content_lines.push(
      `=== Basic Instructions ===`,
      `- If I tell you that you are wrong, think about whether or not you think that's true and respond with facts`,
      `- Avoid apologizing or making conciliatory statements`,
      `- It is not necessary to agree with the user with statements such as "You're right" or "Yes"`,
      `- Avoid hyperbole and excitement, stick to the task at hand and complete it pragmatically`,
      `- If you're unsure, have doubts, or simply want confirmation, just ask the user\n`
    );

    for (const file of context_files) {
      content_lines.push(`=== File: ${file.path} ===`);
      try {
        const content = await this.context_mgr.readFileContent(file.uri);
        content_lines.push(content, "");
      } catch (error) {
        content_lines.push(`Error reading file: ${error}\n`);
      }
    }

    try {
      await vscode.env.clipboard.writeText(content_lines.join("\n"));
      vscode.window.showInformationMessage(
        `Context copied to clipboard! (${this.context_mgr.getContextSize()} files)`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to copy to clipboard: ${error}`);
    }
  }

  private async handleclearContext(): Promise<void> {
    this.context_mgr.clearContext();
    await this.updateContextView();
  }

  private async handleCopySummary(): Promise<void> {
    if (this.context_mgr.getContextSize() === 0) {
      vscode.window.showWarningMessage("No files in context to summarize.");
      return;
    }

    const summary = await this.context_mgr.getSummary();
    const summary_text = `
      Total Files: ${summary.total_files} files
      Total Chars: ${summary.total_chars.toLocaleString()} chars
      Total Tokens: ${summary.total_tokens.toLocaleString()} tokens
    `;

    try {
      await vscode.env.clipboard.writeText(summary_text);
      vscode.window.showInformationMessage("Summary copied to clipboard!");
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to copy summary: ${error}`);
    }
  }

  private async updateContextView(): Promise<void> {
    const context_files = this.context_mgr.getContext();
    const summary_data = await this.context_mgr.getSummary();

    await this.post_message({
      type: "updateContext",
      files: context_files.map((file) => ({
        label: file.path,
        resource: file.uri.toString(),
      })),
      summary: summary_data,
    });
  }
}
