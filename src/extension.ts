import * as vscode from "vscode";
import { Provider } from "./provider";

export function activate(context: vscode.ExtensionContext) {
  const provider = new Provider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(Provider.viewType, provider)
  );

  const register_command = (
    command: string,
    callback: (...args: any[]) => any
  ) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, callback)
    );
  };

  register_command("contextio.addFile", (file_uri: vscode.Uri) => {
    provider.addFileToContext(file_uri);
  });

  register_command("contextio.removeFile", (file_uri: vscode.Uri) => {
    provider.removeFileFromContext(file_uri);
  });

  register_command("contextio.clearContext", () => {
    provider.clearContext();
  });

  register_command("contextio.addOpenFiles", () => {
    provider.addOpenFiles();
  });

  register_command("contextio.exportContext", () => {
    provider.exportContext();
  });

  register_command("contextio.addDroppedFiles", (file_uris: vscode.Uri[]) => {
    file_uris.forEach((uri) => provider.addFileToContext(uri));
  });
}

export function deactivate() {}
