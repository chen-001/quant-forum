'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

// 手册内容数据
const manualContent = {
    '': {
        title: '用户手册',
        content: `
<div class="manual-home">
    <div class="manual-home-icon">📚</div>
    <h1>量化因子交流论坛</h1>
    <p class="manual-home-description">
        欢迎使用量化因子交流论坛！本手册将帮助您快速上手平台的各项功能，
        从发布第一个帖子到使用AI辅助因子探索，轻松掌握所有技巧。
    </p>
    
    <div class="manual-home-sections">
        <a href="/manual/quickstart" class="manual-home-card">
            <div class="manual-home-card-icon">🚀</div>
            <h3>快速开始</h3>
            <p>注册登录、界面导览、发布第一个帖子</p>
        </a>
        <a href="/manual/creator" class="manual-home-card">
            <div class="manual-home-card-icon">📝</div>
            <h3>内容创作者指南</h3>
            <p>发布链接/表格帖子、编辑管理、链接预览</p>
        </a>
        <a href="/manual/discuss" class="manual-home-card">
            <div class="manual-home-card-icon">💬</div>
            <h3>讨论参与者指南</h3>
            <p>发表评论、分类标签、回复互动</p>
        </a>
        <a href="/manual/advanced" class="manual-home-card">
            <div class="manual-home-card-icon">📊</div>
            <h3>研究员进阶功能</h3>
            <p>成果记录、想法区协作、评分系统</p>
        </a>
        <a href="/manual/ai" class="manual-home-card">
            <div class="manual-home-card-icon">🤖</div>
            <h3>AI辅助功能</h3>
            <p>AI聊天、因子探索、智能摘要</p>
        </a>
        <a href="/manual/personal" class="manual-home-card">
            <div class="manual-home-card-icon">📋</div>
            <h3>个人工作管理</h3>
            <p>收藏管理、待办事项、动态追踪</p>
        </a>
    </div>
</div>
        `
    },
    'quickstart': {
        title: '🚀 快速开始',
        prev: null,
        next: { path: '/manual/creator', title: '内容创作者指南' },
        content: `
<h2>欢迎来到量化因子交流论坛</h2>
<p>本指南将帮助您在5分钟内熟悉平台的基本操作。</p>

<h3>1. 注册与登录</h3>
<p>首次使用需要先注册账号：</p>
<ul>
    <li>点击导航栏右上角的"注册"按钮</li>
    <li>填写用户名和密码完成注册</li>
    <li>注册成功后自动登录</li>
</ul>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">quickstart_register.png</div>
</div>

<div class="manual-tip">
    <div class="manual-tip-title">💡 提示</div>
    <p>如果已有账号，直接点击"登录"按钮即可。</p>
</div>

<h3>2. 界面导览</h3>
<p>登录后您将看到论坛首页，主要包含以下区域：</p>
<ul>
    <li><strong>顶部导航栏</strong>：包含发帖、收藏、待办、摘要、动态等入口</li>
    <li><strong>搜索栏</strong>：可按标题、作者、内容搜索帖子</li>
    <li><strong>排序选项</strong>：支持按时间、评分等多维度排序</li>
    <li><strong>帖子列表</strong>：展示所有帖子的卡片式布局</li>
</ul>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">quickstart_homepage.png</div>
</div>

<h3>3. 主题切换</h3>
<p>平台支持深色和浅色两种主题，点击导航栏右上角的主题切换按钮即可切换。</p>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">quickstart_theme_toggle.png</div>
</div>

<h3>4. 发布第一个帖子</h3>
<p>点击导航栏的"发帖"按钮，选择帖子类型：</p>
<ul>
    <li><strong>链接帖子</strong>：分享AI对话链接，支持多个链接</li>
    <li><strong>表格帖子</strong>：创建可编辑的数据表格</li>
</ul>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">creator_post_type_select.png</div>
</div>

<div class="manual-tip">
    <div class="manual-tip-title">💡 下一步</div>
    <p>继续阅读<a href="/manual/creator">内容创作者指南</a>，了解如何创建和管理帖子。</p>
</div>
        `
    },
    'creator': {
        title: '📝 内容创作者指南',
        prev: { path: '/manual/quickstart', title: '快速开始' },
        next: { path: '/manual/discuss', title: '讨论参与者指南' },
        content: `
<h2>内容创作者指南</h2>
<p>本指南帮助您创建、编辑和管理帖子，充分发挥平台的内容分享能力。</p>

<h3>帖子类型选择</h3>
<p>平台支持两种帖子类型，根据内容特点选择：</p>

<table>
    <tr>
        <th>类型</th>
        <th>适用场景</th>
        <th>特点</th>
    </tr>
    <tr>
        <td>🔗 链接帖子</td>
        <td>分享AI对话、外部资源</td>
        <td>支持iframe预览、多链接管理</td>
    </tr>
    <tr>
        <td>📊 表格帖子</td>
        <td>展示结构化数据</td>
        <td>可编辑表格、实时协作</td>
    </tr>
</table>

<h3>创建链接帖子</h3>
<ol class="manual-steps">
    <li>点击导航栏"发帖"按钮，选择"链接帖子"</li>
    <li>填写帖子标题（必填）</li>
    <li>添加AI对话链接，可设置链接标题</li>
    <li>在正文区域补充说明（支持Markdown）</li>
    <li>点击"发布帖子"完成</li>
</ol>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">creator_new_link_post.png</div>
</div>

<h3>链接预览功能</h3>
<p>发布后的帖子中，点击链接标签可以在页面内预览内容：</p>
<ul>
    <li>最多可同时打开4个链接预览</li>
    <li>支持桌面客户端使用webview加载</li>
    <li>浏览器环境可使用代理模式或直连模式</li>
</ul>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">creator_link_preview.png</div>
</div>

<h3>创建表格帖子</h3>
<p>表格帖子适合展示结构化数据，如因子列表、实验结果等：</p>
<ol class="manual-steps">
    <li>点击"发帖"按钮，选择"表格帖子"</li>
    <li>填写标题和正文</li>
    <li>在表格编辑器中输入数据</li>
    <li>可调整列宽和行高</li>
    <li>发布后其他登录用户也可编辑</li>
</ol>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">creator_table_edit.png</div>
</div>

<h3>帖子管理</h3>
<p>作为帖子作者，您可以：</p>
<ul>
    <li><strong>编辑帖子</strong>：修改标题、内容、链接</li>
    <li><strong>置顶帖子</strong>：将重要帖子置顶显示</li>
    <li><strong>删除帖子</strong>：永久删除帖子（不可恢复）</li>
</ul>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">creator_edit_post.png</div>
</div>

<div class="manual-warning">
    <div class="manual-warning-title">⚠️ 注意</div>
    <p>删除帖子将同时删除所有评论、成果和评分，请谨慎操作！</p>
</div>
        `
    },
    'discuss': {
        title: '💬 讨论参与者指南',
        prev: { path: '/manual/creator', title: '内容创作者指南' },
        next: { path: '/manual/advanced', title: '研究员进阶功能' },
        content: `
<h2>讨论参与者指南</h2>
<p>论坛的讨论系统支持分类管理、嵌套回复和丰富的互动功能。</p>

<h3>讨论区布局</h3>
<p>帖子详情页右侧是讨论区，包含：</p>
<ul>
    <li><strong>分类标签</strong>：按链接分组，方便针对性讨论</li>
    <li><strong>搜索框</strong>：快速查找评论</li>
    <li><strong>评论列表</strong>：树形结构展示嵌套回复</li>
    <li><strong>输入框</strong>：支持Markdown和粘贴图片</li>
</ul>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">discuss_comment_area.png</div>
</div>

<h3>发表评论</h3>
<ol class="manual-steps">
    <li>在讨论区底部输入框撰写评论</li>
    <li>选择评论分类（对应某个链接或"自由"）</li>
    <li>支持Markdown语法和LaTeX公式</li>
    <li>可直接粘贴图片上传</li>
    <li>点击"发表"按钮提交</li>
</ol>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">discuss_write_comment.png</div>
</div>

<h3>回复评论</h3>
<p>点击评论下方的"回复"按钮，可以针对特定评论进行回复，形成讨论线程。</p>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">discuss_reply_comment.png</div>
</div>

<h3>评论互动</h3>
<p>每条评论支持以下互动：</p>
<ul>
    <li>👍 <strong>点赞</strong>：表示认同</li>
    <li>🤔 <strong>质疑</strong>：表示有疑问或不同意见</li>
    <li>💬 <strong>回复</strong>：进行讨论</li>
    <li>🏷️ <strong>标签</strong>：修改评论分类</li>
</ul>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">discuss_comment_actions.png</div>
</div>

<h3>修改评论标签</h3>
<p>评论作者可以点击标签按钮，将评论归类到不同的链接分类下，方便整理讨论内容。</p>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">discuss_change_category.png</div>
</div>

<h3>行内评论</h3>
<p>在帖子正文中，选中任意文本可以添加行内评论，方便针对具体内容进行讨论。</p>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">discuss_line_comment.png</div>
</div>
        `
    },
    'advanced': {
        title: '📊 研究员进阶功能',
        prev: { path: '/manual/discuss', title: '讨论参与者指南' },
        next: { path: '/manual/ai', title: 'AI辅助功能' },
        content: `
<h2>研究员进阶功能</h2>
<p>除了基础的发帖和讨论，平台还提供了一系列专为量化研究设计的高级功能。</p>

<h3>成果记录区</h3>
<p>每个帖子都有专门的成果记录区域，用于展示该想法的最终实现结果：</p>
<ul>
    <li>支持Markdown格式</li>
    <li>可添加多个成果记录</li>
    <li>显示作者和时间</li>
</ul>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">advanced_results_section.png</div>
</div>

<h3>想法协作区</h3>
<p>"很有意思的想法区"是一个开放编辑区域，所有登录用户都可以参与编辑：</p>
<ul>
    <li>共同完善想法描述</li>
    <li>记录灵感闪现</li>
    <li>显示最后编辑者</li>
</ul>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">advanced_ideas_section.png</div>
</div>

<h3>评分系统</h3>
<p>对链接帖子进行多维度评分，帮助评估想法质量：</p>
<table>
    <tr>
        <th>维度</th>
        <th>说明</th>
    </tr>
    <tr>
        <td>另类程度</td>
        <td>想法的独特性和创新性</td>
    </tr>
    <tr>
        <td>测试效果</td>
        <td>回测或实盘表现</td>
    </tr>
    <tr>
        <td>构造新颖</td>
        <td>因子构造方法的新颖度</td>
    </tr>
    <tr>
        <td>想法趣味</td>
        <td>想法的趣味性和启发性</td>
    </tr>
    <tr>
        <td>完善程度</td>
        <td>想法的完整度和可执行性</td>
    </tr>
</table>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">advanced_rating_panel.png</div>
</div>

<h3>右键快捷操作</h3>
<p>在帖子内容、评论、成果等区域，右键点击可以唤起快捷菜单：</p>
<ul>
    <li>⭐ 收藏内容</li>
    <li>📋 添加到待办</li>
    <li>📋 复制文本</li>
</ul>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">advanced_context_menu.png</div>
</div>
        `
    },
    'ai': {
        title: '🤖 AI辅助功能',
        prev: { path: '/manual/advanced', title: '研究员进阶功能' },
        next: { path: '/manual/personal', title: '个人工作管理' },
        content: `
<h2>AI辅助功能</h2>
<p>平台集成了多种AI能力，帮助您更高效地进行因子研究和讨论。</p>

<h3>AI聊天助手</h3>
<p>页面右下角的浮动按钮可以打开AI聊天窗口：</p>
<ul>
    <li>根据当前页面上下文提供智能回复</li>
    <li>支持流式输出</li>
    <li>可拖拽调整窗口位置</li>
</ul>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">ai_chat_button.png</div>
</div>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">ai_chat_window.png</div>
</div>

<h3>因子探索工具</h3>
<p>这是平台最强大的功能之一，可以从评论自动生成可执行的因子代码：</p>

<h4>启动探索</h4>
<p>在评论下方点击"🔬 探索"按钮，AI将分析评论内容并生成多个探索方案。</p>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">ai_explore_button.png</div>
</div>

<h4>探索面板布局</h4>
<p>探索面板采用四区域布局：</p>
<ul>
    <li><strong>左侧</strong>：方案列表，可切换不同实现方案</li>
    <li><strong>左上</strong>：方案说明编辑区</li>
    <li><strong>右上</strong>：伪代码编辑区</li>
    <li><strong>左下</strong>：Python代码编辑区</li>
    <li><strong>右下</strong>：中间指标可视化区</li>
</ul>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">ai_explore_modal_overview.png</div>
</div>

<h4>生成与执行流程</h4>
<ol class="manual-steps">
    <li>AI根据评论生成多个探索方案</li>
    <li>查看方案说明和伪代码</li>
    <li>修改伪代码后点击"基于伪代码生成代码"</li>
    <li>设置股票代码和日期</li>
    <li>点击"运行"执行代码</li>
    <li>查看因子结果和可视化图表</li>
</ol>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">ai_explore_execute.png</div>
</div>

<h4>版本历史</h4>
<p>每次执行代码都会自动保存版本，点击"历史"按钮可以查看和恢复之前的版本。</p>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">ai_explore_timeline.png</div>
</div>

<h3>智能摘要管理</h3>
<p>系统会自动为帖子生成AI摘要，包括主题、逻辑、因子、概念等字段，支持人工编辑。</p>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">ai_summaries_page.png</div>
</div>

<div class="manual-tip">
    <div class="manual-tip-title">💡 提示</div>
    <p>用户编辑的摘要会优先于AI生成的内容显示，也可以随时清除恢复AI版本。</p>
</div>
        `
    },
    'personal': {
        title: '📋 个人工作管理',
        prev: { path: '/manual/ai', title: 'AI辅助功能' },
        next: null,
        content: `
<h2>个人工作管理</h2>
<p>平台提供完善的个人工作管理工具，帮助您追踪感兴趣的内容和待办事项。</p>

<h3>收藏管理</h3>
<p>通过右键菜单或收藏按钮，可以将帖子、评论、成果等内容加入收藏：</p>
<ul>
    <li>支持多种内容类型：帖子、评论、成果、文字、图片</li>
    <li>可按类型筛选</li>
    <li>支持"我的"和"大家的"两种视图</li>
    <li>可设置公开/私密</li>
</ul>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">personal_favorites_page.png</div>
</div>

<h3>待办事项</h3>
<p>将需要跟进的内容添加到待办，支持多种来源：</p>
<ul>
    <li>帖子</li>
    <li>评论</li>
    <li>成果</li>
    <li>选中的文字</li>
    <li>图片</li>
</ul>

<h4>待办管理功能</h4>
<ul>
    <li>标记完成/未完成</li>
    <li>添加详细说明（支持Markdown）</li>
    <li>流转给其他用户</li>
    <li>设置公开/私密</li>
</ul>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">personal_todos_page.png</div>
</div>

<h4>待办流转</h4>
<p>点击待办的"流转"按钮，可以将待办转移给其他用户，实现工作交接。</p>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">personal_todo_transfer.png</div>
</div>

<h3>动态追踪</h3>
<p>在"最新动态"页面可以查看全站或与自己相关的活动：</p>
<ul>
    <li><strong>全站动态</strong>：所有用户的公开活动</li>
    <li><strong>与我相关</strong>：涉及自己的评论回复、待办流转等</li>
</ul>

<p>支持按类型筛选：内容、评论、待办、收藏、摘要、探索。</p>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">personal_activities_page.png</div>
</div>

<h3>收藏/待办指示器</h3>
<p>在帖子详情页标题旁，可以看到该帖子是否已被收藏或加入待办，点击可快速操作。</p>

<div class="manual-screenshot-placeholder">
    <div class="manual-screenshot-placeholder-icon">🖼️</div>
    <div class="manual-screenshot-placeholder-text">截图待添加</div>
    <div class="manual-screenshot-placeholder-filename">system_favorite_todo_indicator.png</div>
</div>

<div class="manual-tip">
    <div class="manual-tip-title">🎉 恭喜！</div>
    <p>您已阅读完所有用户手册内容。如有问题，欢迎通过AI聊天助手咨询。</p>
</div>
        `
    }
};

// 导航结构
const navStructure = [
    { id: 'quickstart', icon: '🚀', title: '快速开始' },
    { id: 'creator', icon: '📝', title: '内容创作者指南' },
    { id: 'discuss', icon: '💬', title: '讨论参与者指南' },
    { id: 'advanced', icon: '📊', title: '研究员进阶功能' },
    { id: 'ai', icon: '🤖', title: 'AI辅助功能' },
    { id: 'personal', icon: '📋', title: '个人工作管理' },
];

export default function ManualPage() {
    const params = useParams();
    const section = params?.section?.[0] || '';
    const content = manualContent[section] || manualContent[''];

    return (
        <div className="manual-container">
            {/* 侧边栏 */}
            <aside className="manual-sidebar">
                <div className="manual-sidebar-header">
                    <Link href="/manual" className="manual-sidebar-title">
                        <span>📚</span>
                        <span>用户手册</span>
                    </Link>
                    <div className="manual-sidebar-subtitle">量化因子交流论坛</div>
                </div>

                <nav className="manual-nav">
                    {navStructure.map((item) => (
                        <div 
                            key={item.id} 
                            className={`manual-nav-section ${section === item.id ? 'expanded' : ''}`}
                        >
                            <Link 
                                href={`/manual/${item.id}`}
                                className={`manual-nav-header ${section === item.id ? 'active' : ''}`}
                            >
                                <span className="manual-nav-icon">{item.icon}</span>
                                <span>{item.title}</span>
                            </Link>
                        </div>
                    ))}
                </nav>
            </aside>

            {/* 主内容区 */}
            <main className="manual-main">
                <div className="manual-content">
                    {section === '' ? (
                        <div dangerouslySetInnerHTML={{ __html: content.content }} />
                    ) : (
                        <>
                            <div dangerouslySetInnerHTML={{ __html: content.content }} />
                            
                            {/* 导航按钮 */}
                            <div className="manual-nav-buttons">
                                {content.prev && (
                                    <Link href={content.prev.path} className="manual-nav-button">
                                        <div>
                                            <div className="manual-nav-button-label">← 上一节</div>
                                            <div className="manual-nav-button-title">{content.prev.title}</div>
                                        </div>
                                    </Link>
                                )}
                                {content.next && (
                                    <Link href={content.next.path} className="manual-nav-button next">
                                        <div>
                                            <div className="manual-nav-button-label">下一节 →</div>
                                            <div className="manual-nav-button-title">{content.next.title}</div>
                                        </div>
                                    </Link>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
