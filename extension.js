const vscode = require('vscode')
const formLoader = require('./src/form-loader')
function activate(context) {
    const disposable = vscode.commands.registerCommand(
        'extension.openFormMaker',
        (uri) => formLoader(context, uri)
    )
    context.subscriptions.push(disposable)
}
function deactivate() {}

module.exports = {
    activate,
    deactivate,
}
