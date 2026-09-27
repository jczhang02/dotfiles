---
name: shanhe-computing-server
description: "指导 agent 在 Shanhe Computing 或类似双盘 GPU 服务器上安全使用计算资源：探测存储布局，配置项目外虚拟环境与缓存路径，避免系统盘被项目、数据、模型或 cache 占满。"
---

# Shanhe Computing 服务器使用规范

## 适用场景

当任务涉及 Shanhe Computing / 山河计算服务器时使用本 skill：

- 服务器环境搭建；
- Python / uv / direnv 环境配置；
- GPU 实验运行；
- 项目迁移；
- 数据盘、系统盘路径选择；
- cache、模型权重、日志、checkpoint 路径规划；
- 系统盘清理；
- 避免 `.venv`、数据、模型、输出放错位置。

## 核心原则

先探测，不假设。

Shanhe 服务器常见布局：

```text
系统盘：/、/root、/home/<user>
数据盘：/jczhang02 或其它大容量挂载路径
```

规则：

```text
项目代码：放数据盘
实验数据：放数据盘
模型权重：放数据盘
大日志/输出：放数据盘
cache：放数据盘
虚拟环境：放项目目录外；可放系统盘，但必须先确认空间足够
```

禁止默认创建：

```text
<ProjectRoot>/.venv
<ProjectRoot>/code/.venv
/root/<large-project>
/root/.cache/uv 巨大缓存
```

## Agent 执行流程

按顺序执行：

```text
1. 探测用户、路径、磁盘、GPU。
2. 识别数据盘和项目根目录。
3. 生成变量化路径方案。
4. 对迁移、删除、安装、direnv allow、GPU 长任务先询问用户。
5. 执行最小必要操作。
6. 验证路径、环境、cache、GPU。
7. 汇报最终状态和残留风险。
```

## 路径变量

不要写死项目名。先定义：

```bash
DATA_ROOT="<large-data-mount>"          # 示例：/jczhang02
PROJECT_NAME="<project-name>"
PROJECT_ROOT="${DATA_ROOT}/${PROJECT_NAME}"

# 可放系统盘，但必须确认空间足够。
VENV_ROOT="/root/.venvs"                # 非 root 用户可用 /home/$USER/.venvs
VENV_PATH="${VENV_ROOT}/${PROJECT_NAME}"

CACHE_ROOT="${DATA_ROOT}/.cache"
UV_CACHE_DIR="${CACHE_ROOT}/uv"
```

示例：

```text
DATA_ROOT=/jczhang02
PROJECT_NAME=high-value-patent-rebuild
PROJECT_ROOT=/jczhang02/high-value-patent-rebuild
VENV_PATH=/root/.venvs/high-value-patent-rebuild
UV_CACHE_DIR=/jczhang02/.cache/uv
```

## 只读探测命令

先跑：

```bash
whoami
id
pwd -P
df -h / "${DATA_ROOT:-/jczhang02}" 2>/dev/null || df -h /
df -ih / "${DATA_ROOT:-/jczhang02}" 2>/dev/null || df -ih /
mount | grep -E '/jczhang02|/data|/mnt|/dpc' || true
nvidia-smi || true
```

项目范围检查：

```bash
realpath "$PROJECT_ROOT" 2>/dev/null || true
du -sh "$PROJECT_ROOT" 2>/dev/null || true
find "$PROJECT_ROOT" -maxdepth 3 -name ".venv" -type d -print 2>/dev/null || true
```

不要默认扫整个共享盘：

```bash
# 避免默认执行：
du -hxd1 /jczhang02
```

如需查大盘占用，先问用户。

## 推荐 `.envrc`

放在项目根目录：

```bash
# Shanhe Computing layout:
# project/data/cache on data disk, virtualenv outside project tree.

export UV_PROJECT_ENVIRONMENT="/root/.venvs/<project-name>"
export UV_CACHE_DIR="/jczhang02/.cache/uv"
export UV_LINK_MODE="copy"

export HF_HOME="/jczhang02/.cache/huggingface"
export TORCH_HOME="/jczhang02/.cache/torch"
export MODELSCOPE_CACHE="/jczhang02/.cache/modelscope"
export TRITON_CACHE_DIR="/jczhang02/.cache/triton"
export WANDB_DIR="/jczhang02/<project-name>/artifacts/wandb"

if [ -d "${UV_PROJECT_ENVIRONMENT}/bin" ]; then
    export VIRTUAL_ENV="${UV_PROJECT_ENVIRONMENT}"
    PATH_add "${UV_PROJECT_ENVIRONMENT}/bin"
fi
```

注意：

```text
direnv allow 会执行 .envrc。
必须先读 .envrc，确认无危险命令，再 ask-first。
```

## 创建 uv 环境

执行前确认：

```bash
echo "PROJECT_ROOT=$PROJECT_ROOT"
echo "VENV_PATH=$VENV_PATH"
echo "UV_CACHE_DIR=$UV_CACHE_DIR"
df -h / "$DATA_ROOT"
```

确认 `VENV_PATH` 不在项目目录内：

```bash
case "$(realpath -m "$VENV_PATH")" in
  "$(realpath -m "$PROJECT_ROOT")"/*)
    echo "ERROR: venv is inside project tree"
    exit 1
    ;;
esac
```

创建环境：

```bash
cd "$PROJECT_ROOT"

uv venv "$VENV_PATH"
uv pip install --python "$VENV_PATH/bin/python" -e .
```

若项目有 extras，需用户确认后再安装：

```bash
uv pip install --python "$VENV_PATH/bin/python" -e ".[dev]"
uv pip install --python "$VENV_PATH/bin/python" -e ".[ml,dev]"
```

说明：

```text
ML extras 可能下载 PyTorch、CUDA wheel、vLLM 等大依赖。
必须 ask-first。
```

运行已装好的环境：

```bash
UV_PROJECT_ENVIRONMENT="$VENV_PATH" uv run --no-sync python ...
```

`--no-sync` 仅用于依赖已安装且固定后。新环境首次运行不要默认用。

## GPU 检查

```bash
nvidia-smi
echo "CUDA_VISIBLE_DEVICES=${CUDA_VISIBLE_DEVICES:-unset}"

python - <<'PY'
import torch
print("torch", torch.__version__)
print("cuda_runtime", torch.version.cuda)
print("available", torch.cuda.is_available())
print("device_count", torch.cuda.device_count())
for i in range(torch.cuda.device_count()):
    p = torch.cuda.get_device_properties(i)
    print(i, p.name, round(p.total_memory / 1024**3, 1), "GB")
print("bf16", torch.cuda.is_bf16_supported() if torch.cuda.is_available() else None)
PY
```

若使用 SLURM / submitit：

```bash
sinfo || true
squeue -u "$USER" || true
echo "SLURM_JOB_ID=${SLURM_JOB_ID:-unset}"
echo "SLURM_GPUS=${SLURM_GPUS:-unset}"
```

## 实验运行规则

GPU 长任务必须确认：

```text
预计 GPU 数量
预计运行时间
输出路径
日志路径
checkpoint 路径
是否后台运行
是否使用 SLURM
```

输出、日志、checkpoint 应放数据盘：

```text
${PROJECT_ROOT}/artifacts/
${PROJECT_ROOT}/logs/
${PROJECT_ROOT}/checkpoints/
```

后台任务推荐：

```bash
tmux
# 或 nohup，但必须明确日志路径
```

禁止：

```text
把 checkpoint 写 /root
把 HuggingFace cache 写 /root/.cache/huggingface
SSH 断开会杀掉的裸前台长任务
```

## 项目迁移

若项目误放系统盘：

```text
/root/<project-name>
```

先 dry-run，且 ask-first：

```bash
rsync -aH --dry-run --info=progress2 \
  --exclude '.venv/' \
  --exclude 'code/.venv/' \
  --exclude '.cache/' \
  "/root/<project-name>/" \
  "/jczhang02/<project-name>/"
```

确认后正式迁移：

```bash
rsync -aH --info=progress2 \
  --exclude '.venv/' \
  --exclude 'code/.venv/' \
  --exclude '.cache/' \
  "/root/<project-name>/" \
  "/jczhang02/<project-name>/"
```

验证迁移：

```bash
du -sh "/root/<project-name>" "/jczhang02/<project-name>"
rsync -aHn --delete --itemize-changes \
  --exclude '.venv/' \
  --exclude 'code/.venv/' \
  --exclude '.cache/' \
  "/root/<project-name>/" \
  "/jczhang02/<project-name>/" | head -50
```

不要用 `diff -qr ... | head` 当完整验证。

## 清理策略

清理分两阶段。

### 阶段 1：只读审计

```bash
TARGET="<path-to-clean>"

realpath "$TARGET"
test -d "$TARGET"
du -sh "$TARGET"
ls -ld "$TARGET"
find "$TARGET" -maxdepth 2 -mindepth 1 | head -50
pgrep -u "$USER" -af "$(basename "$TARGET")" || true
```

如果 root 用户操作，不默认检查/删除其他用户目录。必要时先说明风险并问用户。

### 阶段 2：用户确认后删除

删除前必须确认：

```text
目标路径 realpath
目标大小
owner
是否在项目目录/系统目录/数据盘
是否有运行进程
迁移是否完成
```

删除模板：

```bash
TARGET="<confirmed-path>"
: "${TARGET:?TARGET empty}"

case "$(realpath -m "$TARGET")" in
  "/"|"/root"|"/home"|"/jczhang02"|"/data"|"/mnt")
    echo "REFUSE: unsafe target"
    exit 1
    ;;
esac

rm -rf --one-file-system "$TARGET"
```

可清理候选：

```text
/root/<project-name>                 # 已确认迁移完成的旧副本
/root/.venvs/<temporary-env>         # 临时测试环境
<ProjectRoot>/.venv                  # 项目内误建 venv
<ProjectRoot>/code/.venv             # 项目内误建 venv
```

谨慎清理：

```text
/root/.cache/uv
/root/.cache/huggingface
/root/.cache/torch
```

这些可能被多个项目共享。必须确认归属和影响。

禁止自动：

```text
删除非自己 owner 的目录
删除其它项目
删除系统级 conda/base 环境
kill 进程
改 CUDA driver
改系统级 shell profile
```

## 常见错误

错误：

```text
/root/<large-project>
/root/<project-name>/code/.venv
<ProjectRoot>/.venv
<ProjectRoot>/code/.venv
/root/.cache/uv 巨大缓存
/root/.cache/huggingface 巨大模型缓存
checkpoint 写系统盘
日志写系统盘
```

正确：

```text
<ProjectRoot> 在数据盘
<VENV_PATH> 在项目目录外
UV_CACHE_DIR 在数据盘
HF_HOME/TORCH_HOME/MODELSCOPE_CACHE 在数据盘
artifacts/logs/checkpoints 在数据盘项目目录下
```

## 完成标准

### 必需

```text
项目位于数据盘或用户指定大容量盘
项目目录内无 .venv
UV_PROJECT_ENVIRONMENT 指向项目目录外
UV_CACHE_DIR 不在 /root/.cache/uv
HF_HOME / TORCH_HOME 等大 cache 不在系统默认 cache
python 指向预期虚拟环境
磁盘空间和 inode 足够
```

检查模板：

```bash
echo "PWD=$(pwd -P)"
echo "UV_PROJECT_ENVIRONMENT=${UV_PROJECT_ENVIRONMENT:-unset}"
echo "VIRTUAL_ENV=${VIRTUAL_ENV:-unset}"
echo "UV_CACHE_DIR=${UV_CACHE_DIR:-unset}"
echo "HF_HOME=${HF_HOME:-unset}"
echo "TORCH_HOME=${TORCH_HOME:-unset}"
which python
python -V
df -h / "$DATA_ROOT"
df -ih / "$DATA_ROOT"
find "$PROJECT_ROOT" -maxdepth 3 -name ".venv" -type d -print
```

期望：

```text
find .venv 无输出
python 指向 VENV_PATH/bin/python
cache 指向数据盘
```

### 按需

GPU 项目：

```text
nvidia-smi 正常
torch.cuda.is_available() = True
GPU 型号/数量/显存符合任务
```

代码项目：

```text
项目基础测试通过
训练/推理 smoke test 通过
```

## 文档记录规则

稳定、可复用、项目级约束才写项目文档，例如：

```text
AGENTS.md
docs/ops.md
README.md
```

临时环境、个人路径、一次性清理结果，不自动写项目文档。
写文档前 ask-first。

推荐记录：

```text
服务器项目根目录
虚拟环境路径
cache 路径
禁止项目内 .venv
实验输出路径
验证命令和结果
```

## Agent 行为规则

- 先探测，不假设路径。
- 路径全部变量化。
- 不默认运行 `uv sync`，除非确认 `UV_PROJECT_ENVIRONMENT` 已设置。
- 不在项目目录创建 `.venv`。
- 不把大数据、模型、cache、checkpoint 写系统盘。
- 执行大实验前确认 `pwd`、输出路径、GPU 占用。
- `direnv allow` 前必须读 `.envrc` 并 ask-first。
- 安装大依赖、联网下载、GPU 长任务、SLURM 提交必须 ask-first。
- 迁移先 dry-run。
- 删除只读审计后 ask-first。
- 不扫全共享盘，优先项目范围。
- 不删除其它用户/其它项目。
- 不杀进程，除非用户明确要求。
