const vscode = require('vscode')
const fs = require('fs')
const path = require('path')
const open = require('open')
// db.json的文件地址
const dbFilePath = path.join(__dirname, './db.json')
// 技术参考来自于 http://blog.haoji.me/vscode-plugin-webview.html
const callbacks = {
    writeFile: async (message, vscode, dirPath) => {
        const { fileName, code } = message.data
        const filePath = path.join(dirPath, fileName)
        await fs.writeFileSync(filePath, code)
        vscode.window.showInformationMessage(`文件${fileName}创建成功`)
    },

    setStorageItem: (message, _vscode, _dirPath) => {
        const { key, val } = message.data
        const dbContent = fs.readFileSync(dbFilePath).toString()
        if (dbContent) {
            const json = JSON.parse(dbContent)
            json[key] = val
            fs.writeFileSync(dbFilePath, JSON.stringify(json))
        }
    },
    openUrl: (message, _vscode, _dirPath) => {
        open(message.data.url)
    },
}
/**
 * 获取某个扩展文件相对于webview需要的一种特殊路径格式
 * 形如：vscode-resource:/Users/toonces/projects/vscode-cat-coding/media/cat.gif
 * @param context 上下文
 * @param relativePath 扩展中某个文件相对于根目录的路径，如 images/test.jpg
 */
function getExtensionFileAbsolutePath(context, relativePath) {
    return path.join(context.extensionPath, relativePath)
}
/**
 * 从某个HTML文件读取能被Webview加载的HTML内容
 * @param {*} context 上下文
 * @param {*} templatePath 相对于插件根目录的html文件相对路径
 */
function getWebViewContent(context, templatePath) {
    // 文件的绝对地址
    const resourcePath = getExtensionFileAbsolutePath(context, templatePath)
    // 文件夹的绝对地址
    const documentPath = path.dirname(resourcePath)
    let html = fs.readFileSync(resourcePath, 'utf-8')
    // vscode不支持直接加载本地资源，需要替换成其专有路径格式，这里只是简单的将样式和JS的路径替换
    html = html.replace(
        /(<link.+?href="|<script.+?src="|<img.+?src=")(.+?)"/g,
        (m, $1, $2) => {
            return (
                $1 +
                vscode.Uri.file(path.resolve(documentPath, $2))
                    .with({ scheme: 'vscode-resource' })
                    .toString() +
                '"'
            )
        }
    )
    return html
}
const formLoader = (context, uri) => {
    if (!uri) {
        vscode.window.showInformationMessage(`无法获取文件夹路径`)
        return
    }
    /*记录要保存的文件夹地址 begin*/

    // 文件夹地址
    let folderPath
    // 右键点击 可能是文件或者是文件夹
    const documentOrFolderPath = uri.fsPath
    // 通过路径 查找文件相关的属性
    const documentOrFolderOption = fs.lstatSync(documentOrFolderPath)
    // 判断 文件相关的属性 的 isFile 是不是文件 如果是 就将文件地址保存下来 作为后面的参数使用
    if (documentOrFolderOption.isFile()) {
        folderPath = path.dirname(documentOrFolderPath)
    } else {
        folderPath = documentOrFolderPath
    }
    /*记录要保存的文件夹地址 end*/
    // 创建vscode 下面的状态栏
    const statusBarItem = vscode.window.createStatusBarItem()
    statusBarItem.text = `目标文件夹：${folderPath}`
    statusBarItem.color = 'yellow'
    statusBarItem.show()

    // 创建 webview 容器
    const webviewPanel = vscode.window.createWebviewPanel(
        'formMaker',
        '表单设计器',
        vscode.ViewColumn.One,
        {
            enableScripts: true, // 启用JS，默认禁用
            retainContextWhenHidden: true, // webview被隐藏时保持状态，避免被重置
        }
    )

    webviewPanel.onDidChangeViewState((_e) => {
        if (webviewPanel.visible) {
            // webview 容器存在 状态栏就展示
            statusBarItem.show()
        } else {
            // webview 容器消失 状态栏就消失
            statusBarItem.hide()
        }
    })

    // 设置 webview 的主题html
    webviewPanel.webview.html = getWebViewContent(
        context,
        'src/form-loader.html'
    )

    webviewPanel.webview.postMessage({
        cmd: 'setPageUrl',
        data: {
            src:
                vscode.workspace.getConfiguration().get('FormMaker.url') +
                '&t=' +
                new Date(),
            db: JSON.parse(fs.readFileSync(dbFilePath).toString() || '{}'),
        },
    })
    // 接收通讯
    webviewPanel.webview.onDidReceiveMessage(
        (message) => {
            if (message.cmd && message.data) {
                const method = callbacks[message.cmd]
                if (method) method(message, vscode, folderPath)
            } else {
                vscode.window.showInformationMessage(`没有与消息对应的方法`)
            }
        },
        undefined,
        context.subscriptions
    )
    webviewPanel.onDidDispose((e) => {
        statusBarItem.dispose()
    })
}

module.exports = formLoader
