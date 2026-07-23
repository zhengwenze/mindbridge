# MindBridge RAG 金标与指标操作说明

## 1. 文件职责

- `app/rag_eval/policy-question-drafts.tsv`：模型辅助起草的问题池，不是金标数据集。
- `app/rag_eval/mindbridge-rag-gold.json`：只有人工审核完成后才创建或更新的正式金标。
- `app/rag_eval/gold_runner.py`：读取正式金标，调用当前检索服务并计算标准指标。

模型可以继续补充问题，但不得填写 TSV 中以 `human_` 开头的列，也不得把 `review_status` 改成 `APPROVED`。

## 2. 人工标注流程

1. 标注人员先阅读冻结版本的知识文档，不查看系统当前排名和分数。
2. 对每条问题填写是否应该进入知识检索、应该选择哪些知识库，以及所有真正相关的 locator。
3. 一个问题可能有多个相关 locator，不能只标最容易命中的一个。
4. 第二名标注人员独立复核；有分歧时由第三人裁决。
5. 只有最终确认的样本才写入 `mindbridge-rag-gold.json`，并填写真实 reviewer 和 `APPROVED`。
6. 金标冻结并计算 SHA-256 后，才能第一次查看正式测试集的检索排名。

正式金标示例：

```json
[
  {
    "id": "policy-017",
    "question": "心理咨询的内容是不是无论发生什么都不会告诉任何人？",
    "annotationStatus": "APPROVED",
    "reviewer": "人工审核人姓名或编号",
    "relevantItems": [
      {
        "source": "policies/campus-counseling-policy-general-guide.md",
        "locator": "POLICY-CONFIDENTIALITY-005",
        "relevance": 2
      }
    ]
  }
]
```

## 3. 三个指标如何从单条查询计算

固定 `K=4`。假设某问题共有三个相关 locator：A、B、C，系统前四名只覆盖 B，且 B 排在第 2 名：

```text
Recall@4 = 召回的不同相关 locator 数 / 全部相关 locator 数 = 1 / 3
RR@4     = 1 / 第一个相关结果的排名 = 1 / 2
Hit@4    = 前四名是否至少命中一个相关 locator = 1
```

如果前四名没有相关项，则三个值都是 0。全数据集指标是所有有效查询的宏平均：

```text
Recall@4  = mean(每条查询的 Recall@4)
MRR@4     = mean(每条查询的 RR@4)
Hit Rate@4 = mean(每条查询的 Hit@4)
```

因此 Recall@4 和 Hit Rate@4 不应相等：只命中多个相关项中的一个时，Hit 为 1，但 Recall 小于 1。

## 4. 正式运行条件

主指标必须来自真实 MySQL 和真实向量模型，不得使用 SQLite 或 mock embedding：

```bash
docker compose exec -T app env \
  KNOWLEDGE_VECTOR_ENABLED=true \
  KNOWLEDGE_VECTOR_REQUIRED=true \
  EMBEDDING_MODEL=qwen3-embedding:0.6b \
  python -m app.rag_eval.gold_runner \
    --dataset /app/app/rag_eval/mindbridge-rag-gold.json \
    --output /app/data/evaluation/mindbridge-rag-gold-report.json \
    --top-k 4 \
    --knowledge-base 校园心理咨询政策库 \
    --require-hybrid
```

运行器会拒绝空 reviewer、未 `APPROVED`、没有相关项或主实验未强制向量的样本。本政策数据集显式限定“校园心理咨询政策库”，用于测量路由已经选对知识库后的检索排序；普通聊天和项目外负样本另行测量路由误检索率。BM25-only 降级实验应另存报告，不能替代主指标。

负样本路由评测命令：

```bash
docker compose exec -T app \
  python -m app.rag_eval.negative_runner \
    --dataset /app/app/rag_eval/mindbridge-rag-negative.json \
    --output /app/data/evaluation/mindbridge-rag-negative-routing-report.json
```

该报告使用当前意图分类链路验证负样本是否被判为 `CHAT`。`CHAT` 不进入 `KnowledgeAgent`；若被判为 `CONSULT` 或 `RISK`，则计为一次误检索。

## 5. 数据集规模

当前 48 条只是政策库第一阶段的问题池，其中包含普通聊天负样本，不能直接作为最终检索指标数据集。建议最终独立测试集覆盖全部知识文档，并至少包含：

- 每篇文档 15 至 20 条可回答问题；
- 原词、同义改写、口语噪声、易混淆来源和多相关项问题；
- 普通聊天和项目外负样本，用于单独计算误检索率；
- 开发集与最终测试集分离，最终测试集不得用于调整权重。

负样本用于端到端路由评测，不直接进入 Recall/MRR/Hit Rate 的分母，因为它们没有相关文档。
