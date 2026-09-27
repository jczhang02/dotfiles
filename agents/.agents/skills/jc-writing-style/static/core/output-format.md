# Output format

## Default

Return the requested text directly.

Do not prepend `以下是` or explain the process.

## When useful

If the user asks for calibration or review, add after the text:

```text
风格校准：
- 模式：...
- 保留：...
- 调整：...
```

Keep notes to at most three bullets.

## If information is missing

If missing evidence blocks correctness, ask one concise question.

If drafting can proceed safely, use visible placeholders:

- `[补充数据集名称]`
- `[补充实验结果]`
- `[补充项目时间]`
- `[补充引用]`

## If multiple versions are requested

Return numbered versions. Keep each version meaningfully different in structure or tone, not synonym swaps.
