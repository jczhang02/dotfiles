# 体裁：审稿回复（response letter）

由 SKILL.md 的 §3 路由到这里。

## 骨架与写法

**Cover letter**："Dear Editors and Reviewers," → one sentence of gratitude for the reviewing effort → "We try our best to address all the concerns raised by the reviewers. Below we provide our detailed response to their comments." → "We hope that the applied revisions are to the satisfaction of the editors." → "Kind regards, The Authors".

**每条回复的骨架**：

1. **一次致谢**，强度随意见分量变化："Thanks for your suggestion." / "Thanks for pointing out this problem." / "Thanks for your valuable question." / 特别有洞见的意见用一句更重的感谢（"We greatly admire your scientific intuition shown in this comment …, which help us to think deeply about …"）。一条回复只谢一次。
2. **说明动作**："According to your suggestion, in the revised manuscript, we …"
3. **讲清楚**：意见里有误解时，先正面说明事实（"In Eq.(5), $\mathbf{V}$ is not a permutation matrix. The specific analysis is as follows:"），用 `1)` `2)` 分点：先澄清，再讲设计动机。
4. **拿证据**：审稿人提议的替代方案，先承认可行（"In fact, we have considered …, which is theoretically feasible."），再做成一个有名字的变体（SFS-A、SFS-Hungarian），报告准确率和效率两张表，用结果回应（"However, through experiments, it is found that …"）。
5. **承认原稿的问题**："In our previous manuscript, the meaning of … was not explained in detail, leading to misunderstanding by the reader. We have corrected this problem in the revised manuscript."
6. **贴出修改后的原文**：用红色 `quote` 块，带小节标题。
7. **指路收尾**："Please refer to Section … for details. Thanks."

**审稿人推荐文献时**：逐篇列出，每篇一句话概括（"In the first paper, ``Title'', the authors proposed …"）；然后按相关度分组，说明哪些任务不同（"Differently, our proposed method aims to …"），哪篇相关、已引用、区别在哪；共用的通用技术直接说明不是本文创新点（"… is not the main innovation point of our paper"）。

**轻量意见**两三句答完（重画图、校对、改拼写）："Thanks for your suggestion. In the revised manuscript, we replot these figures to improve their readability. Please refer to Fig.2 and Fig.3 in the revised paper for details." 第二轮没有新意见的审稿人："Thanks for your comments."

**完成标准**：每条意见都有回应；每个"we have added/revised"都能在修改稿里找到位置；每个反驳都有推导或实验；没有一句是在跟审稿人抬杠。

## 样例

Source: captured — SFS-SLL 两轮审稿回复信（2022–2023）。样例是 JC 的原文，是**形状**，不是可复用的句子：学力度、顺序、从哪里起头、取舍怎么讲、结尾由什么构成。不要把原句搬进输出（JC 本轮明确要求的除外）。样例里的小语法错误保留原貌以便识别节奏，输出时要修正。

### Response letter (SFS-SLL, two rounds)

Cover letter:

> Dear Editors and Reviewers,
>
> We express our gratitude for the time and effort dedicated to the reviewing of our submitted manuscript. We try our best to address all the concerns raised by the reviewers. Below we provide our detailed response to their comments. We hope that the applied revisions are to the satisfaction of the editors.
>
> Kind regards,
> The Authors

A light comment:

> **Comment.** The authors should carefully proofread this paper and correct all the typos in the revision.
>
> **Answer.** Thanks for your suggestion and carefulness when reviewing our work. In the revised manuscript, we have conducted a very careful proofreading to avoid typos/grammar errors and invited a native speaker to polish the paper. Thanks.

An alternative the reviewer proposed (answered with a named variant and experiments):

> **Comment.** The fixed membership matrix $\mathbf{U}$ in Eq. 2 may lead to suboptimal performance. Why not include it into the iterative optimization process? …
>
> **Answer.** Thanks for your valuable question. In fact, we have considered including Eq.(2) into the iterative optimization process with the subsequent feature selection process, which is theoretically feasible. The specific objective function of this method (here we simply name it SFS-A) is as follows: [equation]
> However, through experiments, it is found that this approach substantially increases the running time of the algorithm, since the algorithm needs to continuously compute the distances between the clustering centers $\mathbf{o}$ and the samples $\mathbf{x}$ to update the soft label matrix. The experimental results of feature selection efficiency between our proposed method SFS-SLL and the method SFS-A are reported in Table 2. [table]
> Moreover, the method SFS-A will add a hyperparameter $\sigma$ to the objective function, which increases the difficulty of optimizing the algorithm. We conduct feature selection accuracy comparison experiments between the proposed method and SFS-A. … [table] As shown in Table 3, the reported results demonstrate that our proposed method outperforms the single stage method SFS-A on feature selection accuracy.

Suggested references (summarize, separate, concede):

> **Answer.** Thanks for your suggestion and providing these important references.
> - In the first paper, ``…'', the authors proposed two frameworks that consist of both convolutional and recurrent network … to precisely identify human intentions.
> - In the second paper, ``…'', the authors proposed a semi-supervised feature selection method for video semantic recognition task, …
> - In the third paper, ``…'', the authors proposed a semi-supervised model based on the attention mechanism and recurrent convolutional network …
>
> The task and learning mechanism of our proposed method are different from those of the first and third references. The first and third references focus on the representation learning, … Differently, our proposed method aims to solve the feature selection problem, … The second paper proposed a semi-supervised feature selection method, namely OGE-SFS. We have cited this paper in the revised manuscript. However, this paper differs from our proposed method (SFS-SLL), the detailed analysis is as follows: … In addition, both methods adopt sparse regression in the objective function for feature selection as this is a relatively common solution of feature selection at present, and is not the main innovation point of our paper.
>
> Please refer to Section I. Introduction and References [5] for details. Thanks.

Second round, admitting the original text was unclear:

> **Answer.** Thanks for your suggestions. In our previous manuscript, the meaning of the true label matrix $\mathbf{L}$ was not explained in detail, leading to misunderstanding by the reader. We have corrected this problem in the revised manuscript. … Besides, according to your suggestion, we design a variant method named SFS-Hungarian. In this method, we consider $\mathbf{V}$ as a permutation matrix and treat the solution process of $\mathbf{V}$ as a hard assignment problem. Finally, we solve the formulation using Hungarian algorithm. …
