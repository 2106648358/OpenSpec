# Capability Markers and Spec-Code Traceability

## 1. 背景与动机

OpenSpec 项目中，`openspec/specs/` 下的 spec 描述了系统的能力，`src/` 下的代码实现了这些能力。目前两者之间没有显式的关联记录，导致：

- **Spec 变更时**：不知道哪些代码文件需要相应修改
- **代码变更时**（git diff 看到某文件变了）：不知道需要更新哪个 spec
- **平行变更时**：不知道哪些 change 涉及同一个 capability，可能产生冲突

本设计通过两套机制解决以上问题：

1. **Capability Markers** — 在 `.openspec.yaml` 中声明 change 与系统能力之间的关系，形成跨 change 的共享词汇表
2. **Spec-Code Traceability** — 在 spec 和代码之间建立双向索引，实现 O(1) 的 spec↔code 映射查找

---

## 1.1 Schema Strategy

本设计引入的 capability markers 和 traceability 机制属于一个新的 schema，**不是对现有 `spec-driven` schema 的修改**。

| 名称 | 说明 | 适用场景 |
|---|---|---|
| `spec-driven` | 当前默认 schema：proposal → specs → design → tasks | 不需要 traceability 的 change |
| `spec-driven-traceable` | 在 `spec-driven` 的基础上增加 traceability | 需要 recording capability ↔ code 映射的 change |

`spec-driven-traceable` 包含 `spec-driven` 的全部 artifacts（proposal、specs、design、tasks），新增：
- `.openspec.yaml` 中的 **capability markers** 字段（`provides`、`requires`、`touches`、`dependsOn`）
- **`traceability.json`** 作为 tasks 阶段的额外产出

用 `openspec schema fork spec-driven spec-driven-traceable` 可创建一个副本进行定制。现有 `spec-driven` change 的 `.openspec.yaml` 不变，不受影响。

---

## 2. Capability Markers

### 2.1 解决的问题

每个 change 可以声明自己提供了什么能力、依赖了什么能力、碰到了什么区域。这为 change 之间的依赖管理和 traceability 提供了共享的 capability 标识符。

### 2.2 Capability ID 格式

采用层级短名，句点分隔：

```
<area>[/<sub-area>]
```

例如：

```
auth/session
auth/lockout
cli/archive
cli/spec
openspec-conventions
```

规则：
- 全小写
- 层级用 `/` 分隔，最多两级（`<area>/<sub>`）
- `area` 对应 `openspec/specs/<area>/` 目录

### 2.3 `.openspec.yaml` 新增字段

```yaml
# 现有字段
schema: spec-driven-traceable
created: 2026-06-29

# 新增：capability markers
provides:             # 此 change 新增或修改的能力（traceability 以这些为主）
  - auth/session
requires:             # 此 change 依赖但未修改的能力
  - auth/lockout
touches:              # 此 change 触碰到但不拥有的能力（信息性，无依赖关系）
  - auth/middleware
dependsOn:            # 此 change 排序依赖的其他 change（archive 时据此确定顺序）
  - add-password-timeout
```

| 字段 | 含义 | 在 traceability 中的语义 |
|---|---|---|
| `provides` | 此 change 新增或修改此能力 | 这个 capability 下的 codeLocation 是 change 主动产生或修改的 |
| `requires` | 此 change 依赖此能力已存在 | 不会产生新的 codeLocation mapping，仅用于依赖分析 |
| `touches` | 此 change 碰到的相邻区域，无依赖关系 | archive 时如果已有引用则追加信息性标记 |
| `dependsOn` | 此 change 依赖的其他 change 名称 | 用于 archive 时的 change 排序，不参与 traceability |

### 2.4 语义规则

1. **`provides` / `requires` 不产生隐式依赖**：有 `requires` 不代表需要排序，显式声明 `dependsOn` 才是排序的依据
2. **`touches` 仅信息性**：用于并发 change 的 overlap 检测，不作为依赖的判定依据
3. **capability ID 全局一致**：同一 capability 在不同 change 中必须使用相同的 ID
4. **所有字段可选**：向后兼容，没有 capability markers 的 change 照常工作

### 2.5 与 spec 目录结构的关系

`openspec/specs/<area>/<sub>/spec.md` 自然对应 capability ID `<area>/<sub>`。当存在 `specs/<area>/spec.md` 且不存在 `specs/<area>/<sub>/spec.md` 时，capability ID 为 `<area>`。

---

## 3. Spec-Code Traceability

### 3.1 核心数据模型

两个文件构成完整的 traceability：

```
openspec/
├── changes/
│   └── [change-name]/
│       └── tasks/
│           └── traceability.json    ← (1) per-change，不可变
├── .traceability/
│   └── index.json                   ← (2) 累积索引，archive 时增量更新
```

#### (1) Per-change traceability — 生成时机

在 tasks artifact 完成时生成（AI 在产出代码后附带输出此文件）。**生成后不再修改**。

`tasks/traceability.json`：

```json
{
  "formatVersion": "1",
  "change": "add-password-timeout",
  "createdAt": "2026-06-29",
  "mappings": [
    {
      "capability": "auth/session",
      "requirement": "密码登录超时",
      "type": "provides",
      "codeLocations": [
        { "file": "src/auth/session.ts", "symbol": "checkSessionTimeout" },
        { "file": "src/auth/session.ts", "symbol": "SessionManager.refresh" },
        { "file": "src/auth/middleware.ts", "symbol": "timeoutGuard" }
      ]
    }
  ]
}
```

`type` 字段表示此 mapping 的类型，控制 archive 时的合并行为：

| `type` 值 | 含义 | 合并行为 |
|---|---|---|
| `provides`（默认） | change 新增或修改此 capability | 全量覆盖 forward 索引的 `current` |
| `touch` | change 仅触碰到此 capability | 不修改 forward 索引，仅在 reverse 追加引用 |

`type` 可选，省略时默认为 `provides`。AI 生成 `traceability.json` 时，应对 `.openspec.yaml` 中 `provides` 的能力使用 `type: "provides"`，对 `touches` 的能力使用 `type: "touch"`。

**校验规则**：单个 `traceability.json` 中不允许出现重复的 `(capability, requirement)` 对。如有重复，archive 时应报错。`provides` 和 `touch` 视为不同的 mapping，不在此限制内。

#### (2) 累积索引 — 更新时机

在 archive 时将当前 change 的 traceability 合并入累积索引。

`.traceability/index.json`：

```json
{
  "formatVersion": "1",
  "lastUpdated": "2026-07-01",

  "forward": {
    "auth/session": {
      "密码登录超时": {
        "current": [
          { "file": "src/auth/session.ts", "symbol": "checkSessionTimeout" },
          { "file": "src/auth/session.ts", "symbol": "SessionManager.refresh" },
          { "file": "src/auth/middleware.ts", "symbol": "timeoutGuard" }
        ]
      }
    }
  },

  "reverse": {
    "src/auth/session.ts": {
      "checkSessionTimeout": {
        "implements": ["auth/session/密码登录超时"]
      },
      "SessionManager.refresh": {
        "implements": ["auth/session/密码登录超时"]
      }
    },
    "src/auth/lockout.ts": {
      "LockoutService.increment": {
        "implements": ["auth/密码错误锁定"]
      }
    }
  }
}
```

### 3.2 CodeLocation 格式

```
{
  "file":   "src/auth/session.ts",    // 文件路径，相对于项目根
  "symbol": "SessionManager.refresh", // 符号名（主定位）
  "span":   [12, 45],                 // 可选：行号范围
  "line":   12                        // 可选：重载消歧
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `file` | 是 | 相对于项目根的文件路径 |
| `symbol` | 是 | 函数/方法/类名。主定位，跨重构更鲁棒 |
| `span` | 否 | 行号范围 `[start, end]`，精确的范围信息，不参与索引匹配 |
| `line` | 否 | 定义行号，用于重载消歧（极少需要） |

**关于 symbol vs span**：

- `symbol` 是主定位。当 symbol 跨文件重构或重命名时，可 fallback 到文件名级匹配
- `span` 是信息性补充，不参与索引匹配。两个 requirement 可以指向同一个 symbol 的不同 span（例如同一函数的前半段和后半段对应不同的 requirement）
- `line` 只在重载场景需要：`Parser.parse` 有多个签名，且不同签名实现不同的 requirement

### 3.3 回溯机制

#### 方向 1：Spec → Code

```
spec 变了（"密码登录超时"被修改）
  → forward["auth/session"]["密码登录超时"].current
  → [src/auth/session.ts:checkSessionTimeout, src/auth/session.ts:SessionManager.refresh, ...]
  → git diff 这些文件，确认哪些需要更新
```

#### 方向 2：Code → Spec

```
代码变了（git diff 看到 src/auth/session.ts 被修改）
  → reverse["src/auth/session.ts"]
  → 遍历其中的 symbol 看哪些在 diff 范围内
  → ["auth/session/密码登录超时"]
  → 找到对应的 spec 条目，检查是否需要同步
```

双向索引都是 O(1) 查找。

### 3.4 Archive 时的合并规则

```python
def merge_into_index(index, change_trace):
    for mapping in change_trace.mappings:
        capability = mapping.capability
        requirement = mapping.requirement
        new_locations = mapping.codeLocations
        mapping_type = mapping.get("type", "provides")

        if mapping_type == "touch":
            # Touch：只追加 reverse 引用，不修改 forward 索引
            for loc in new_locations:
                file_key = loc["file"]
                symbol_key = loc["symbol"]
                ref = f"{capability}/{requirement}"
                index.reverse.setdefault(file_key, {}).setdefault(symbol_key, {
                    "implements": []
                })["implements"].append(ref)
            continue

        # provides：全量覆盖（change 总是提供此 requirement 的完整代码映射）
        old_current = index.forward.get(capability, {}).get(requirement, {}).get("current", [])

        index.forward.setdefault(capability, {})[requirement] = {
            "current": new_locations
        }

        # Reverse：清除旧引用，建立新引用
        for loc in old_current:
            file_key = loc["file"]
            symbol_key = loc["symbol"]
            ref = f"{capability}/{requirement}"
            if file_key in index.reverse and symbol_key in index.reverse[file_key]:
                index.reverse[file_key][symbol_key]["implements"] = [
                    r for r in index.reverse[file_key][symbol_key]["implements"]
                    if r != ref
                ]
                if not index.reverse[file_key][symbol_key]["implements"]:
                    del index.reverse[file_key][symbol_key]

        for loc in new_locations:
            file_key = loc["file"]
            symbol_key = loc["symbol"]
            ref = f"{capability}/{requirement}"
            index.reverse.setdefault(file_key, {}).setdefault(symbol_key, {
                "implements": []
            })["implements"].append(ref)
```

**核心原则**：
- 每次 merge 是对该 requirement 的全量覆盖，不是 diff 合并
- `type: "provides"` 和 `type: "touch"` 的合并行为不同：
  - `provides`：覆盖 forward 索引的 `current`，并重建 reverse 引用
  - `touch`：不修改 forward 索引，仅在 reverse 追加引用（不会覆盖已有引用）
- 不在累积索引中保留任何变更历史（历史走 git log）

---

## 4. 完整示例

### 4.1 Change A：add-password-timeout

`.openspec.yaml`：

```yaml
schema: spec-driven-traceable
created: 2026-06-29
provides:
  - auth/session
touches:
  - auth/middleware
```

`tasks/traceability.json`：

```json
{
  "formatVersion": "1",
  "change": "add-password-timeout",
  "createdAt": "2026-06-29",
  "mappings": [
    {
      "capability": "auth/session",
      "requirement": "密码登录超时",
      "type": "provides",
      "codeLocations": [
        { "file": "src/auth/session.ts", "symbol": "checkSessionTimeout" },
        { "file": "src/auth/session.ts", "symbol": "SessionManager.refresh" }
      ]
    },
    {
      "capability": "auth/middleware",
      "requirement": "会话超时守卫",
      "type": "touch",
      "codeLocations": [
        { "file": "src/auth/middleware.ts", "symbol": "timeoutGuard" }
      ]
    }
  ]
}
```

Archive A 后，累积索引（`touch` mapping 不修改 forward，仅在 reverse 追加引用）：

```json
{
  "formatVersion": "1",
  "lastUpdated": "2026-07-01",
  "forward": {
    "auth/session": {
      "密码登录超时": {
        "current": [
          { "file": "src/auth/session.ts", "symbol": "checkSessionTimeout" },
          { "file": "src/auth/session.ts", "symbol": "SessionManager.refresh" }
        ]
      }
    }
  },
  "reverse": {
    "src/auth/session.ts": {
      "checkSessionTimeout": { "implements": ["auth/session/密码登录超时"] },
      "SessionManager.refresh": { "implements": ["auth/session/密码登录超时"] }
    },
    "src/auth/middleware.ts": {
      "timeoutGuard": { "implements": ["auth/middleware/会话超时守卫"] }
    }
  }
}
```

### 4.2 Change B：modify-timeout-behavior

`.openspec.yaml`：

```yaml
schema: spec-driven-traceable
created: 2026-07-15
provides:
  - auth/session
```

`tasks/traceability.json`：

```json
{
  "formatVersion": "1",
  "change": "modify-timeout-behavior",
  "createdAt": "2026-07-15",
  "mappings": [
    {
      "capability": "auth/session",
      "requirement": "密码登录超时",
      "type": "provides",
      "codeLocations": [
        { "file": "src/auth/session.ts", "symbol": "checkSessionTimeout" },
        { "file": "src/auth/session.ts", "symbol": "SessionManager.refresh" },
        { "file": "src/auth/session.ts", "symbol": "notifyTimeout" }
      ]
    }
  ]
}
```

Archive B 后，累积索引中的 `auth/session/密码登录超时`：

```json
"密码登录超时": {
  "current": [
    { "file": "src/auth/session.ts", "symbol": "checkSessionTimeout" },
    { "file": "src/auth/session.ts", "symbol": "SessionManager.refresh" },
    { "file": "src/auth/session.ts", "symbol": "notifyTimeout" }
  ]
}
```

change A 的两个 session.ts symbol 被保留（B 也引用了它们）。reverse 索引中 Change A 通过 `type: "touch"` 为 `auth/middleware/会话超时守卫` 建立的 `src/auth/middleware.ts/timeoutGuard` 引用不受影响（B 不涉及该 capability，不会清除 touch 创建的引用）。

> **注**：`touches` 在 archive 时不会覆盖已有 current 映射，只会追加引用。上述示例中 A 的 `touches: auth/middleware` 在累积索引中体现为 reverse 索引的一条引用，但不在 forward 索引中占据 `current` 位置。

---

## 5. 设计决策与理由

### 5.1 为什么累积索引只存"当下"，不存历史

**决策**：累积索引中的 `current` 总是该 requirement 的最新完整快照。

**理由**：
- 历史走 `git log`，不需要在索引里重复存储
- 避免了一半的合并复杂度
- 索引的目标是"现在是什么"，而不是"谁改过"

### 5.2 为什么是全量覆盖（不是 diff）

**决策**：archive 时用 change 的 mapping 直接覆盖累积索引中对应 requirement 的 `current`。

**理由**：
- change 的 mapping 总是该 requirement 的完整快照 — AI 生成 traceability 时能看到所有相关代码
- 不需要读历史 + 计算 diff

### 5.3 为什么 symbol 是主定位

**决策**：codeLocation 以 `symbol` 为主，`span` 和 `line` 为可选补充。

**理由**：
- 符号名跨文件重构更鲁棒（行号会持续偏移）
- 如果符号被重命名，可以 fallback 到文件名级匹配
- `span` 维护成本高，只作信息用

### 5.4 为什么 capability 是层级路径

**决策**：使用 `area/sub` 而非扁平字符串或 URI。

**理由**：
- 与 `openspec/specs/` 目录结构自然对应
- 比扁平名（`auth` 太模糊）更精确
- 比完整 URI（`cap:auth:session`）更简洁

### 5.5 为什么 per-change 文件不可变

**决策**：`traceability.json` 生成后不再修改。

**理由**：
- archive 时只读，不需要处理读-写冲突
- 不可变文件是可靠的审计线索

### 5.6 文件名惯例

- Per-change：`tasks/traceability.json`（遵循 OpenSpec 无特殊前缀的文件名惯例）
- 累积索引：`.traceability/index.json`（`.` 前缀表示此目录由工具自动管理，用户不应手动编辑）

### 5.7 为什么是独立 schema 而非修改现有 schema

**决策**：capability markers 和 traceability 以独立 schema `spec-driven-traceable` 引入，而非在 `spec-driven` 上原地新增。

**理由**：
- **渐进采用**：现有 change 不受影响，无需迁移
- **测试隔离**：可以在新 schema 下实验和验证 traceability 流程，不影响默认工作流
- **schema 的自然边界**：traceability 是元数据层（关于 change 的数据），不同于 spec-driven 的 artifacts（change 的内容），属于不同的关注维度
- **fork 路径可演化**：通过 `openspec schema fork` 派生的副本可以独立演化，不影响内置 schema

---

## 6. 使用方式

创建需要 spec-code traceability 的 change 时，选择 `spec-driven-traceable` schema，并在 `.openspec.yaml` 中声明 capability markers：

```yaml
schema: spec-driven-traceable
created: 2026-06-29
provides:
  - auth/session
touches:
  - auth/middleware
```

实现完成后，在 change 的 `tasks/traceability.json` 中记录 code locations。archive 该 change 时，OpenSpec 会读取该文件并更新 `openspec/.traceability/index.json`。`spec-driven` change 会保持原有 archive 行为。
