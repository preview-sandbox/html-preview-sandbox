# html-preview-sandbox 使用文档(中文)

> 安全地渲染不可信 HTML,同时保留它的交互能力。
> English docs: see [README.md](../README.md) and [docs/INTEGRATION.md](INTEGRATION.md).

## 这是什么

`html-preview-sandbox` 是一条**不可信 HTML 的安全预览管线**。当你的应用需要展示来路不明的 HTML——AI 生成的报告、聊天/邮件附件、用户上传的文件——直接用 `innerHTML` 或裸 `<iframe>` 都有风险,而只做清洗又会剥掉脚本、丢失交互。本库把五层防御打包成开箱即用的方案:

```
输入 → 解码 → 清洗 → CSP 策略 → 桥接 → 沙箱 iframe
```

图表、动画和表单控件可以保留交互,但表单提交外传会被默认策略拦截;内容运行在不共享宿主来源的沙箱里,默认策略会阻断主要的攻击者可读外传通道,并把外链和可观测导航交给宿主决策。

**它不做什么**:不是浏览器(不浏览 URL)、不是附件系统(下载/缓存/权限是你的事)、不是 DOMPurify 替代品(清洗只是其中一层)。

## 安装

```bash
npm install html-preview-sandbox
```

- 仅提供 ESM 构建,要求 Node 18+
- 浏览器基线:Chrome/Edge 90+、Firefox 90+、Safari 14+、Electron 12+(详见 [BROWSER_SUPPORT.md](BROWSER_SUPPORT.md))

## 快速上手

```js
import { createPreview } from 'html-preview-sandbox';

const preview = createPreview(document.querySelector('#preview'), {
  csp: 'strict',
  // 外链回调:不提供则外链被丢弃(fail-closed)。这里用系统方式打开。
  onOpenExternal(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  },
});

// 输入可以是 HTML 字符串,也可以是 File / Blob / ArrayBuffer / Uint8Array
await preview.render(htmlStringOrFile);
```

容器 `#preview` 需要有确定的尺寸(库会在里面塞一个撑满的 iframe)。

## 核心 API

### `createPreview(container, options)` → `PreviewHandle`

在 `container`(一个 `HTMLElement`)里创建并管理沙箱 iframe。返回句柄:

| 方法 | 说明 |
|------|------|
| `render(input)` | 渲染输入,返回 `{ html, encoding, sanitizeReport }` |
| `updateOptions(patch)` | 局部更新选项;CSP/清洗类变更需重新 `render` 生效 |
| `notifyNavigationAttempt(url)` | 宿主(如 Electron 主进程)观察到 iframe 自我导航时调用,库会重挂载上次可信内容并走外链决策 |
| `destroy()` | 销毁 iframe、解绑监听 |
| `iframe` | 当前 iframe 元素(只读) |

### 低层纯函数(服务端 / 自定义渲染)

```js
import { sanitizeHtml, buildCsp, createHtmlDocument } from 'html-preview-sandbox';

sanitizeHtml(htmlString, options);        // 只清洗,返回 { html, report }
buildCsp('strict');                        // 返回 CSP 字符串
await createHtmlDocument(input, options);  // 走完整管线但不建 iframe,返回最终 HTML 字符串
```

`createHtmlDocument` 适合"要管线不要 iframe"的场景——比如你自己管理 webview,只想拿到处理好的安全 HTML。

## 选项 `PreviewOptions`

| 选项 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `csp` | `'strict'\|'balanced'\|'offline'\|CspPolicy` | `'strict'` | CSP 预设或自定义策略 |
| `sanitize` | `SanitizeOptions` | — | 清洗白名单覆盖(见下) |
| `maxBytes` | `number` | 100 MB | 超限触发 `onError`(code `OVERSIZED`) |
| `sandboxTokens` | `string[]` | 见下 | 覆盖 iframe sandbox 属性(逃生舱) |
| `allowUnsafeSandboxTokens` | `boolean` | `false` | 放行高危 token(`allow-same-origin` 等) |
| `externalProtocols` | `string[]` | `http/https/mailto/tel` | 外链协议白名单 |
| `allowExternalUrl` | `(url, ctx) => boolean` | — | 逐 URL 的自定义放行决策 |
| `injectScrollbarStyle` | `boolean` | `true` | 注入兜底滚动条样式 |
| `logger` | `Console` 子集 | — | 注入日志器 |

### 事件回调

| 回调 | 触发时机 |
|------|----------|
| `onOpenExternal(url, ctx)` | 用户点外链 / `window.open` 时。**不提供则外链被丢弃** |
| `onCspViolation(report)` | 沙箱内发生 CSP 违例(可用于观测被拦了什么) |
| `onSanitize(report)` | 清洗完成,报告删了哪些标签/属性/协议 |
| `onNavigationAttempt(url, ctx)` | 宿主导航拦截触发(需宿主适配层) |
| `onError(err)` | 出错:`OVERSIZED` / `DECODE_FAILED` / `EMPTY_AFTER_SANITIZE` / `RENDER_FAILED` |

## CSP 三预设(按"数据外传能力"分层)

关键理念:预设不是按"能加载哪些资源"分,而是按"**不可信 HTML 能不能把数据发到攻击者可读的位置**"分。

| 预设 | 语义 | 适用 |
|------|------|------|
| `offline` | **零网络**,不进不出 | 合规 / 离线 / 隐私敏感 |
| `strict`(默认) | **阻断攻击者可读的外传通道**(`connect-src 'none'`、`form-action 'none'`、img/media 无通配主机);放行 inline 脚本、`unsafe-eval`、固定 CDN/字体主机 | 内容不可信(IM、邮件、AI 报告) |
| `balanced` | 开放 `https:` 图片/媒体 + `connect-src https:`,**存在通用外传面** | 内容半可信、需要远程资源或 fetch |

> ⚠️ 注意:`strict` **不是"零网络"**——白名单主机的请求仍会离开本机,残余低带宽侧信道见 [THREAT_MODEL.md](../THREAT_MODEL.md)。真正零网络请用 `offline`。

**自定义 CSP**:

```js
createPreview(el, {
  csp: {
    preset: 'strict',
    imgHosts: ['https://cdn.example.com'],  // 追加图片主机(不打开通配)
    scriptHosts: ['https://my.cdn.com'],    // 追加脚本白名单
    // directives: { 'connect-src': 'https://api.example.com' }  // 逃生舱:直接覆盖,风险自负
  },
});
```

## 自定义清洗 `SanitizeOptions`

```js
createPreview(el, {
  sanitize: {
    allowScripts: true,        // 默认 true;false 则退化为"只清洗不跑脚本"
    allowInlineEvents: true,   // 默认 true,仅放行用户主动触发型(onclick 等),自动触发型(onload)始终剥除
    extraTags: ['my-widget'],  // 追加标签白名单
    extraAttributes: { 'my-widget': ['data-config'] },
    extraSchemes: ['app'],     // 追加协议白名单
    dropTags: ['canvas'],      // 从默认白名单移除
  },
});
```

## 场景示例

### 预览用户上传的 HTML 文件

```js
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  await preview.render(file);  // 直接传 File,库内部解码
});
```

### 预览 AI 生成的报告(需要 CDN 图表库)

```js
// strict 默认已放行主流 CDN(cdnjs/jsdelivr/tailwind/jquery),多数报告可直接跑。
const preview = createPreview(el, { csp: 'strict', onOpenExternal });

// 仅当报告需要「远程图片/媒体」或「fetch 外部 API」时,才切 balanced
// (balanced 开放了 img-src https: 和 connect-src https:,存在通用外传面)。
// const preview = createPreview(el, { csp: 'balanced', onOpenExternal });
```

### 观测安全在工作(拦截可视化)

```js
createPreview(el, {
  onSanitize: (r) => console.log('清洗删除:', r.removedTags, r.removedSchemes),
  onCspViolation: (r) => console.log('CSP 拦截:', r.effectiveDirective, r.blockedURI),
  onOpenExternal: (url) => console.log('外链请求:', url),
});
```

### Electron:补齐自我导航防御

纯 Web 拦不住 iframe 里的 `window.location = ...`(`Location` 是 `[Unforgeable]`)。Electron 主进程能观察到所有 frame 导航,可补齐这一层:

```js
// 主进程:监听导航 → IPC 通知渲染层
win.webContents.on('will-frame-navigate', (details) => {
  if (!details.isMainFrame) win.webContents.send('nav-attempt', details.url);
});
// 渲染层:
window.previewHost.onNavigationAttempt((url) => preview.notifyNavigationAttempt(url));
```

完整可运行示例见 [`examples/electron/`](../examples/electron/)。

## 框架封装

- **Web Component**:`examples/web-component/` 里有一个 `<safe-html-preview>` 自定义元素,可直接照抄
- **React / Vue**:v0.1 暂未内置封装,可基于 `createPreview` 自行包一层(在 `useEffect`/`onMounted` 里 create、卸载时 `destroy`)

## 安全边界(务必了解)

**防**:窃取宿主数据、危险协议、自动跳转、外链逃逸、常见 XSS 向量、默认 `strict` 下的主要攻击者可读外传通道。

**不防**:沙箱内的死循环/CPU 占用、钓鱼式内容、用户主动往表单填敏感信息、浏览器/运行时自身漏洞、未知的清洗器绕过。

安全来自**五层纵深**,不承诺任何单层无懈可击。详见 [THREAT_MODEL.md](../THREAT_MODEL.md) 与 [SECURITY_MODEL.md](SECURITY_MODEL.md)。发现漏洞请走 [SECURITY.md](../SECURITY.md) 的私密披露渠道,不要开公开 issue。

## 在线体验

本地跑 Playground(粘贴 HTML → 看安全预览 + 实时拦截可视化):

```bash
npm run build
npm run serve
# 打开 http://localhost:4173/playground/
```
