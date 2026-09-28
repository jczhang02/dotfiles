# 体裁：论文正文

由 SKILL.md 的 §3 路由到这里。

## 骨架与写法（英文期刊稿）

**Introduction 骨架**（这是 JC 最稳定的结构）：

1. Trend + tension: "Along with the growth of …, … continued to be generated. On the one hand, … On the other hand, …, posing great challenges for …" → "Thus, determining how to … has become a critical problem." → "In fact, only …" → the task is introduced with a citation.
2. Taxonomy: "… has received much attention recently, and many approaches have been proposed. According to …, these methods can be roughly classified as …, …, and …." One or two sentences per class, "In contrast, …", "Generally, …".
3. Gap: "For many …, …. Therefore, …. This might lead … to …. Besides, …, while … cannot …."
4. Proposal: "Motivated by the above analyses, in this paper, we propose an effective … (ABBR) model. Specifically, we first … After that, we … Then, we … Finally, we derive …"
5. Contributions: "The main contributions of this paper are summarized as follows:" three bullets: (i) the idea and unified framework, with what it uncovers and how it is optimized; (ii) efficiency or complexity with the concrete reason; (iii) "Experiments on N benchmark datasets demonstrate the superiority of the proposed method on …", plus the code URL.
6. Roadmap: "The rest of this paper is organized as follows: Section … gives a brief review of … In Section …, we propose … The experimental results are reported in Section … Finally, we give the conclusion and outlook of the paper in Section …"

**Method / analysis**：define every symbol at first use ("where … denotes …"); state convexity and convergence plainly; give per-variable complexity, then the overall one under an explicit assumption ("Assuming that $n \gg c, n \gg d$, …"); point forward to the experiment that verifies it ("In the subsection …, our experiments verify …").

**Experiments**："In this section, we report …"; "For simplicity, we denote … as … in the following content."; list datasets with footnote URLs and one or two sentences each on size and representation ("Each image is represented as a 1,024-dimensional vector."); baselines grouped by type with "i.e.,"; "Similar to previous work [..], we use the commonly adopted evaluation metric …"; tables with underline / bold / italics conventions stated in the text; the efficiency discussion admits the faster baselines and says what is traded.

**Conclusion**：one paragraph. Motivation sentence → "With this motivation, we propose …, which can better …" → "Besides, we develop a simple yet effective optimization method based on …" → "Extensive experimental results show that the proposed method can outperform … in terms of …" → "In the future, we will … Moreover, we expect to …" Future work names concrete extensions, not generic improvement.

**完成标准**：每个 gap 都在 proposal 里有对应；贡献第 (ii) 条有具体原因；所有 claim 都有实验或引用支撑；"state-of-the-art""superiority"只在有表格支撑时出现。

**中文论文或报告**：沿用同一套论证顺序（背景矛盾 → 分类 → 不足 → 本文方法 → 贡献 → 结构），但要按中文书面语重写，不要从英文逐句翻译。

## 样例

Source: captured — SFS-SLL 期刊论文终稿（已发表）。样例是 JC 的原文，是**形状**，不是可复用的句子：学力度、顺序、从哪里起头、取舍怎么讲、结尾由什么构成。不要把原句搬进输出（JC 本轮明确要求的除外）。样例里的小语法错误保留原貌以便识别节奏，输出时要修正。

### Paper (SFS-SLL, published version)

Introduction, opening paragraph:

> Along with the growth of information technology, high-dimensional data continued to be generated. On the one hand, these high-dimensional and large-scale data can better characterize the information of samples and improve the performance of subsequent learning tasks such as classification and clustering. On the other hand, such data may lead to the curse of dimensionality and computational inefficiency, posing great challenges for data mining and exploitation. Thus, determining how to process this data and apply it to various fields, such as information retrieval and semantic recognition, has become a critical problem. In fact, only a subset of the features in a high-dimensional vector is valuable, and the remaining features may be noisy and redundant. Feature selection is developed to choose the optimal feature subset from the original feature space by measuring the discriminative capability of each feature.

Gap → proposal → contributions:

> Several approaches are proposed to solve the feature selection problem in the semi-supervised learning paradigm by learning pseudo-labels. For many semi-supervised feature selection methods, label learning and feature selection are independent of each other. Therefore, these methods rely solely on the initial construction of pseudo-labels to guide the feature selection process. This might lead these methods to select a suboptimal subset of features. Besides, many methods in this class use hard labels as the semantic supervision, while hard labels cannot reflect the subordination of samples and clusters. Real-world data have fuzziness, so the continuous data labels can better reflect the probability of a sample belonging to each cluster center.
>
> Motivated by the above analyses, in this paper, we propose an effective Semi-supervised Feature Selection with the Soft Label Learning (SFS-SLL) model. Specifically, we first obtain the clustering centers and construct the initial soft label matrix by calculating the distances between clustering centers and samples with Fuzzy C-Means clustering. After that, we adopt the given manual labels to guide the optimization process of the soft label with a simple supervised semantic constraint. Then, we integrate the dynamic adjustment process of the soft label and the feature selection process into a unified learning framework with sparse regression. Finally, we derive an alternate optimization method based on the Alternating Direction Method of Multipliers (ADMM) to iteratively optimize the soft label and feature selection matrix. The main contributions of this paper are summarized as follows:
>
> - We introduce soft label learning into semi-supervised feature selection and propose a unified framework that simultaneously performs soft label learning and feature selection. Soft labels can better uncover the intrinsic semantics hidden in the data. … Besides, a supervised semantic constraint is added to the soft label learning process to improve the quality of soft labels. …
> - We propose an efficient semi-supervised feature selection model with linear computational complexity, which can be applied to large-scale data. By separating the process of constructing the initial soft label from the entire framework, our method eliminates the time consumption of updating clustering centers and distances, and significantly reduces the overall computational complexity.
> - Experiments on seven benchmark datasets demonstrate the superiority of the proposed method on feature selection accuracy and efficiency. We provide source codes at https://github.com/jczhang02/SFS-SLL.

Complexity analysis:

> We solve the objective function by the alternative optimization method, that is, the whole solving process is divided into several parts (multiple iterations). We denote the number of iterations as $t$. At each iteration, the computational complexity of updating the projection matrix $\mathbf{F}$ is $O(n \times d^3)$. Besides, the time complexity of updating the soft label matrix $\mathbf{A}$ is $O(n \times d \times c)$, and the time complexity of updating the projection matrix $\mathbf{V}$ is $O(c^2 \times n)$. Assuming that $n \gg c, n \gg d$, the whole time complexity of the optimization process is $O(t \times n)$.

Conclusion:

> Soft labels can better preserve the significant information of the sample compared with hard labels. With this motivation, we propose an effective semi-supervised feature selection model with soft label learning, which can better uncover the intrinsic semantics hidden in the data. Besides, we develop a simple yet effective optimization method based on the Alternating Direction Method of Multipliers (ADMM) to solve the proposed objective formulation. Extensive experimental results show that the proposed method can outperform existing semi-supervised feature selection methods in terms of both accuracy and efficiency. In the future, we will leverage manual labels sufficiently to accurately predict the labels of unlabelled samples and further improve the performance of the proposed method. Moreover, we expect to extend our method to handle multi-view data and explore how to learn the involved parameters adaptively.
