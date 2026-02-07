import * as vscode from 'vscode';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface GitChange {
    file: string;
    content: string;
    document: vscode.TextDocument;
}

export class GitManager {
    async getUnstagedChanges(): Promise<GitChange[]> {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) {
            return [];
        }

        const { stdout } = await execAsync('git diff --name-only', { cwd: workspace.uri.fsPath });
        const files = stdout.split('\n').map(file => file.trim()).filter(Boolean);

        const changes: GitChange[] = [];
        for (const file of files) {
            const fileUri = vscode.Uri.joinPath(workspace.uri, file);
            try {
                const document = await vscode.workspace.openTextDocument(fileUri);
                const content = document.getText();
                changes.push({ file, content, document });
            } catch (error) {
                // Ignore files we cannot open (deleted or binary)
            }
        }

        return changes;
    }
}
