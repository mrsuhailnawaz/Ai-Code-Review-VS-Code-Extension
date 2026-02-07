import * as vscode from 'vscode';
import { ReviewHistoryEntry, ReviewResult } from '../types/reviewTypes';

const HISTORY_KEY = 'aiCodeReviewer.history';

export class HistoryProvider implements vscode.TreeDataProvider<HistoryItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<HistoryItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private history: ReviewHistoryEntry[];

    constructor(private context: vscode.ExtensionContext) {
        this.history = this.context.globalState.get<ReviewHistoryEntry[]>(HISTORY_KEY, []);
    }

    getTreeItem(element: HistoryItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: HistoryItem): Thenable<HistoryItem[]> {
        if (element) {
            return Promise.resolve([]);
        }

        if (this.history.length === 0) {
            return Promise.resolve([new HistoryItem('No review history yet', '')]);
        }

        return Promise.resolve(this.history.map(entry => new HistoryItem(entry.fileName, this.formatEntry(entry))));
    }

    addReview(uri: vscode.Uri, review: ReviewResult) {
        const entry: ReviewHistoryEntry = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            fileName: uri.fsPath,
            issueCount: review.issues.length,
            timestamp: Date.now(),
            summary: review.summary
        };

        this.history = [entry, ...this.history].slice(0, 50);
        this.persist();
    }

    clear() {
        this.history = [];
        this.persist();
    }

    private persist() {
        this.context.globalState.update(HISTORY_KEY, this.history);
        this._onDidChangeTreeData.fire();
    }

    private formatEntry(entry: ReviewHistoryEntry): string {
        const date = new Date(entry.timestamp).toLocaleString();
        return `${entry.issueCount} issue${entry.issueCount === 1 ? '' : 's'} • ${date}`;
    }
}

class HistoryItem extends vscode.TreeItem {
    constructor(label: string, description: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.description = description;
        this.contextValue = 'historyItem';
    }
}
