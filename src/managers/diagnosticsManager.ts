import * as vscode from 'vscode';

export class DiagnosticsManager {
    private collection: vscode.DiagnosticCollection;

    constructor() {
        this.collection = vscode.languages.createDiagnosticCollection('ai-code-reviewer');
    }

    set(uri: vscode.Uri, diagnostics: vscode.Diagnostic[]) {
        this.collection.set(uri, diagnostics);
    }

    clearForFile(uri: vscode.Uri) {
        this.collection.delete(uri);
    }

    clear() {
        this.collection.clear();
    }

    dispose() {
        this.collection.dispose();
    }
}
