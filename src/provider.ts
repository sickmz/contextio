import * as vscode from "vscode";
import { context_manager } from "./context_manager";
import { file_service } from "./file_service";
import { message_handler } from "./message_handler";

export class Provider implements vscode.WebviewViewProvider {
  public static readonly viewType = "contextio.view";

  private _view?: vscode.WebviewView;
  private context_mgr: context_manager;
  private file_svc: file_service;
  private msg_handler?: message_handler;

  constructor(private readonly _extension_uri: vscode.Uri) {
    this.context_mgr = new context_manager(_extension_uri);
    this.file_svc = new file_service(_extension_uri);
  }

  public resolveWebviewView(
    webview_view: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webview_view;

    webview_view.webview.options = {
      // @ts-ignore
      enableScripts: true,
      localResourceRoots: [this._extension_uri],
    };

    webview_view.webview.html = this._getHtmlForWebview(webview_view.webview);

    this.msg_handler = new message_handler(
      this.context_mgr,
      this.file_svc,
      (message: any) => webview_view.webview.postMessage(message)
    );

    webview_view.webview.onDidReceiveMessage(async (data) => {
      if (this.msg_handler) {
        await this.msg_handler.handleMessage(data);
      }
    });
  }

  public addFileToContext(file_uri: vscode.Uri) {
    const added = this.context_mgr.addFile(file_uri);
    if (added) {
      this.updateContextView();
    }
  }

  public removeFileFromContext(file_uri: vscode.Uri) {
    const removed = this.context_mgr.removeFile(file_uri);
    if (removed) {
      this.updateContextView();
    }
  }

  public clearContext() {
    this.context_mgr.clearContext();
    this.updateContextView();
  }

  public addOpenFiles() {
    vscode.window.tabGroups.all.forEach((tab_group) => {
      tab_group.tabs.forEach((tab) => {
        const input = tab.input;
        if (
          input instanceof vscode.TabInputText &&
          input.uri.scheme === "file"
        ) {
          this.addFileToContext(input.uri);
        }
      });
    });
  }

  public async exportContext() {
    if (this.msg_handler) {
      await (this.msg_handler as any).handleexportContext();
    }
  }

  private async updateContextView() {
    if (!this._view) return;

    const context_files = this.context_mgr.getContext();
    const summary_data = await this.context_mgr.getSummary();

    await this._view.webview.postMessage({
      type: "updateContext",
      files: context_files.map((file) => ({
        label: file.path,
        resource: file.uri.toString(),
      })),
      summary: summary_data,
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const script_uri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extension_uri, "media", "main.js")
    );
    const style_uri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extension_uri, "media", "main.css")
    );
    const codicons_uri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extension_uri,
        "node_modules",
        "@vscode",
        "codicons",
        "dist",
        "codicon.css"
      )
    );
    const toolkit_uri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extension_uri,
        "node_modules",
        "@vscode",
        "webview-ui-toolkit",
        "dist",
        "toolkit.js"
      )
    );
    const nonce = Array.from(
      { length: 32 },
      () =>
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[
          Math.floor(Math.random() * 62)
        ]
    ).join("");

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<script type="module" src="${toolkit_uri}"></script>
				<link href="${style_uri}" rel="stylesheet">
				<link href="${codicons_uri}" rel="stylesheet" />
				<title>Contextio</title>
			</head>
			<body class="vscode-body">
				<div class="main-content">
					<div class="context-header">
						<span>Search</span>
					</div>
					<div class="search-container">
						<vscode-text-field id="searchInput" placeholder="@files or / for commands">
							<span slot="start" class="codicon codicon-search"></span>
						</vscode-text-field>
					</div>
					<ul id="searchResults"></ul>
					<div class="context-container" id="context-container">
						<div class="context-header">
							<span>Context</span>
							<div class="actions">
								<vscode-button id="clearContextBtn" appearance="icon" title="Clear Context">
									<span class="codicon codicon-close-all"></span>
								</vscode-button>
							</div>
						</div>
						<div id="contextPills" class="pill-container">
							<p class="drop-hint">Drag and drop files here (hold shift)</p>
						</div>
					</div>
					<div id="summary-container" class="context-container" style="display: none;">
						<div class="context-header">
							<span>Summary</span>
              </div>
						<div id="context-summary"></div>
					</div>
				</div>
				<div class="footer-actions">
					<vscode-button id="exportBtn" appearance="primary" title="Export context">
						Export context
					</vscode-button>
				</div>
				<script nonce="${nonce}" src="${script_uri}"></script>
			</body>
			</html>`;
  }
}
