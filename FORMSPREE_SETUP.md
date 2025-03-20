# FormSpree表单设置说明

本文档介绍如何设置[FormSpree](https://formspree.io/)来处理人体研究问卷的表单提交。

## 什么是FormSpree？

FormSpree是一个简单的表单处理服务，允许静态网站（如GitHub Pages）处理表单提交而无需编写后端代码。它提供免费和付费计划。

## 设置步骤

### 1. 创建FormSpree账户

1. 访问[formspree.io](https://formspree.io/)
2. 点击"Sign Up"创建一个新账户（可以使用GitHub账户登录）
3. 验证您的电子邮件地址

### 2. 创建新表单

1. 登录FormSpree账户
2. 点击"New Form"按钮
3. 填写表单名称（例如："Human Study Questionnaire"）
4. 选择表单类型（可选）
5. 点击"Create Form"

### 3. 获取表单ID

创建表单后，您将获得一个表单ID。它看起来像这样：`xrgkpzlq`（示例）。

### 4. 更新questionnaire.js文件

1. 打开`questionnaire.js`文件
2. 找到以下行：
   ```javascript
   const formSpreeEndpoint = 'https://formspree.io/f/YOUR_FORM_ID';
   ```
3. 将`YOUR_FORM_ID`替换为您的实际FormSpree表单ID

### 5. 测试表单提交

1. 部署更新后的网站（推送到GitHub）
2. 填写并提交问卷
3. 检查FormSpree仪表板，确认是否收到提交
4. 您还会收到一封电子邮件通知（基于FormSpree设置）

## 表单提交数据结构

每次提交的数据格式如下：

```javascript
{
  "evaluator": {
    "name": "用户姓名",
    "email": "用户邮箱",
    "additionalComments": "其他评论"
  },
  "responses": [
    {
      "videoId": "视频ID",
      "selectedOption": 选择的选项索引,
      "comments": "用户对该视频的评论"
    },
    // 更多视频响应...
  ],
  "submittedAt": "ISO格式的时间戳"
}
```

## 查看提交数据

1. 登录FormSpree
2. 找到您的表单
3. 查看"Submissions"选项卡
4. 您可以查看所有提交的详细信息
5. 可以将数据导出为CSV或通过FormSpree API访问

## 高级设置（可选）

FormSpree提供更多高级功能：

- 表单验证规则
- 垃圾邮件保护
- 重定向URL自定义
- 电子邮件通知自定义
- Webhooks集成
- 等等

查看[FormSpree文档](https://help.formspree.io/)了解更多信息。

## 故障排除

如果表单提交不工作：

1. 检查浏览器控制台是否有错误
2. 确认FormSpree ID正确
3. 确保网站没有CORS或CSP限制
4. 免费计划有提交数量限制，检查是否超出限制 