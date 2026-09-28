# 体裁：汇报（讲稿 + slide）

由 SKILL.md 的 §3 路由到这里。讲稿和 slide 成对出现：只要其中一个时也读完整文件，因为讲稿要指向 slide 上的内容，slide 要压缩讲稿。

## 讲稿（汇报 / 答辩 / 竞赛）

**格式**：逐页写，每页一段，标"页 N"（LaTeX 讲稿用 `enumerate`，标签 `\textbf{\textit{页~}\arabic*}.`；纯文本用 `页 N:`）。每页一到四句，只做一件事，和 slide 上的那一页对应。

**骨架**（按页推进，页数随内容伸缩）：

1. 问候与题目。中："各位老师，同学，大家好！很荣幸向大家作主题为'……'的报告！"（团队项目可用"代表项目组"）。英："Good morning, reviewers and students! I am …, and the topic of my research is ``…''."
2. 路线图，报出部分数（"从动机、方法、实验……六个方面"）。另一种写法是用几个关键词概括工作（"从三个关键词阐述我们工作的主要内容：一是……二是……三是……"），适合项目型汇报。
3. 动机：领域矛盾（一方面/另一方面）。
4. 问题枚举：一是/二是（/三是），每条定义 + 后果 + 指图（"如右侧图片所示"）。
5. 引出方向："因而，……应运而生。"然后说已有工作的共性问题，逐条列（这里可以放类比）。
6. 改进：先总起一句（"对于这些提及的问题，我们的工作中做了一些改进。"），再按问题的顺序写成一段，用"为了……，我们……""此外"衔接，不再编号。
7. 方法：先总述（"基于上述分析，我们提出了……"），再按模块推进，每步先直觉后公式后符号。模块之间的过渡用"此后""现在，我们需要考虑……的设计。""基于上述的对各部分的介绍，在这里给出……总体目标函数。"
8. 实验：先说做了哪几组、用了多少数据集，再报结论，再解释原因（"这主要是因为……"），有输的地方直接说。
9. 应用与示例（如有）：具体数据集、具体数字、具体发现。
10. 总结：动机 → 方法 → 结果，"总体而言，"起头。
11. 发表或成果（如有）：平铺直叙，给出期刊、分区、影响因子等可核实信息。
12. 致谢（英文答辩常见：点名导师和帮助者）与未来工作。
13. 收尾："我的报告到此结束。恳请各位评委老师批评指正！" / "Thanks to the reviewers!"

**口语化处理**：公式不念全，只念它干什么；引用只在 slide 脚注，讲稿里不念文献；指代 slide 内容时用"这里""左侧图片中""在表 3 中"。

**完成标准**：每页讲稿都能对上一页 slide；问题与改进条数相等且顺序一致；至少一处诚实的取舍或不足；没有任何编造的数字。

## Slide

**骨架**：标题页 → 目录页（与讲稿路线图一致）→ 各节 → 总结 →（发表情况）。页眉导航显示各节名。

**写法**：
- **标题写成论点或具体话题**，而不是泛泛的"背景"："数据与机器学习模型性能间的矛盾""数据中的主要问题""研究现状：半监督特征选择""Deep Learning for PDE: Neural-FEM"。
- **要点短句**，中文用分号结尾；用"标签：解释"的形式压缩（"高维：维度灾难；""冗余/噪声：呈现伪相关。"）。
- **推理链用箭头**：同时包含"有标签"和"无标签"数据 ⟹ 半监督数据 ⟹ 需要构建伪标签。
- **关键结论单独一行、加感叹号**：⟹ 算法性能严重依赖初始伪标签的质量！
- **描述列表**做对比或定义：`pros.` / `cons 1.` / `cons 2.`；`Problem.` / `Input.` / `Output.`
- **颜色有语义**：红色标问题或最关键的论断，蓝色标次要的对比项；粗体标术语。不是装饰。
- **渐进展开**：同一标题的页面逐步追加要点（"改进和创新"一页一页加第 1、2、3 条），或用 `\only<1>` 先给图或定义，`\only<2>` 再给要点。
- **公式页**：公式下写"其中……为……"；目标函数用 `\underbrace` 标出各部分的含义（软标签学习 / 监督语义约束 / 稀疏回归）。
- 引用用脚注完整条目（`\footfullcite`）；图有编号和说明性图题（"图 1: 数据中的问题"）。
- 可以用一个时下的热点来接地气（例如用 ChatGPT 的训练数据处理说明"数据问题影响模型"），但必须有可核实的依据。

**完成标准**：slide 上没有讲稿里的完整长句；每个标题都能说出一个论点；颜色和箭头都有明确的用处。

## 样例

Source: captured — 国创年会讲稿与 slide（中文，2024）、大创项目结题答辩讲稿（中文，2023）、本科毕设答辩讲稿与 beamer（英文，2024）。样例是 JC 的原文，是**形状**，不是可复用的句子：学力度、顺序、从哪里起头、取舍怎么讲、结尾由什么构成。不要把原句搬进输出（JC 本轮明确要求的除外）。样例里的小语法错误保留原貌以便识别节奏，输出时要修正。

### 中文讲稿（国创年会，选段）

> 页 1: 各位老师，同学，大家好！很荣幸向大家作主题为"基于软标签学习的半监督特征选择方法"的报告！
>
> 页 2: 我将从动机、方法、实验、应用和示例、总结和论文发表情况等六个方面来阐述。
>
> 页 3: 在过去的二十年中，机器学习领域一直存在一个显著的矛盾：一方面，信息技术的发展使数据不断涌现，推动了机器学习的飞跃。另一方面，数据中存在的问题往往会影响模型的性能，提出新的挑战。
>
> 页 4: 这些数据中主要存在以下两类问题：
> 一是，许多数据是高维的，这是指数据中有较多的输入变量，即"特征"。这样的数据容易诱发维度灾难，使分析，处理数据的时间复杂度呈指数级增长。左侧图片中较为直观的体现当特征维度超过一定值时，机器学习模型的性能会有一定衰减。
> 二是，许多数据中包含了一些冗余特征和噪声特征。这些特征可能会使数据集呈现伪相关关系，影响模型学习过程。如右侧图片所示，在简单的回归任务中，一些数据可能导致拟合出错误的回归方程。
>
> 页 6: 将机器学习模型直接应用到原始数据中，往往无法取得好的效果。我们需要先基于生成的伪标签，进行数据处理来降低数据维度，去除冗余特征和噪声特征。因而，半监督特征选择应运而生。在半监督特征选择领域已经诞生出许多出色的工作，但这些工作存在一些较为普遍的问题。
>
> 页 7: 一是，许多方法使用非 0 即 1 的硬标签作为伪标签和语义监督信息。这样的伪标签忽略了数据中的模糊性，只能指示某一样本是否属于某一类，而无法辨别该样本和某一类的准确的隶属关系。毕竟，人与人之间的关系还有亲疏远近的等级分别，而不是只有好与不好两种关系。
>
> 页 9: 三是，许多方法的时间复杂度较高，计算时间较长，无法应用在大规模数据集上。但特征选择方法本身作为数据处理的工具和机器学习模型的一个插件，理应具备较高的效率。
>
> 页 10: 对于这些提及的问题，我们的工作中做了一些改进。为了提高语义监督信息的质量，我们用软标签替换了硬标签。这里的软标签是和硬标签截然相反的，它用 [0, 1] 闭区间内的概率值来指示样本和类别间的隶属度关系，这与数据中天然存在的模糊性相得益彰。此外，我们还引入了监督语义约束模块，将原有数据中的原始标签信息转移到软标签中，借助原有标签提高软标签，即语义监督信息，的质量。
>
> 页 13: 基于上述分析，我们提出了一种基于软标签学习的半监督特征选择方法。首先，我们先学习得到初始软标签。具体来说，对于输入数据矩阵 X，通过模糊聚类算法得到了一个初始软标签矩阵 U。其中 U 中的元素 uij 代表第 i 个样本属于第 j 类的概率。
>
> 页 16: 现在，我们需要考虑特征选择过程的设计。自然，对数据矩阵 X 和投影矩阵 F，XᵀF 是原始数据在 c 维空间中的低维表示。为了使这种低维表示也具有和原始数据相似的结构信息，我们基于稀疏回归的思想，使 XᵀF 逼近于软标签矩阵 A。并添加了 l2,1 范数的约束，使 F 具有行稀疏性，即仅有小部分的行向量 fi 是非 0 的，从而选择出最终特征子集。
>
> 页 18: 再来简单介绍我们的工作的一些实验内容和结果。我们使用了 7 个较为常见的数据集，进行了准确率对比实验和效率对比实验。在准确率对比实验中，我们的方法在大多数情形下都优于其他方法，甚至要优于这里的有监督特征选择方法 RFS。
>
> 页 19: 这主要是因为我们即基于数据中天然存在的模糊性，引入了软标签学习的技术，也使用了监督语义约束模块，有效的从原有标签中学习语义监督信息。
>
> 页 20: 其次是效率对比实验。在表 3 中，我们提出的方法的结果用紫色下划线表示，运行时间最少的方法的结果用红色表示，次少的方法的结果用蓝色表示。实验结果表明，我们所提出的方法在效率方面优于大部分对比方法。与 SemiFS 和 URAFS 相比，我们提出的方法的效率虽然略低于它们，但在特征选择准确率上有较大的优势。
>
> 页 24: 我们给出一个应用的示例，我们从美国国家癌症研究所网站上获取了真实人类肝细胞癌的基因表达数据集，该数据包含 367 个样本和三个肝细胞癌亚类。我们借助提出的算法从 2000 个基因选择出了这三个基因作为对肝细胞癌亚类分类影响最大的关键基因（即 NRCAM，SALL2 和 EGLN3）。
>
> 页 26: 总体而言，由于数据中天然存在的模糊性，与硬标签相比，软标签能更好地包含数据中的重要语义信息。基于这个动机，我们提出了一种高效的半监督特征选择方法，该方法可以较好地揭示隐藏在数据中的内在语义信息。此外，我们基于交替方向乘子法（ADMM），提出了一个简单而有效的优化方法，以解决所提出的目标函数。大量实验结果表明，该方法在准确率和效率方面均优于现有的半监督特征选择方法。
>
> 页 27: 目前，我已作为第一作者将该工作发表在自动化学报英文版，期刊为中科院 SCI 一区，影响因子为 11.8，在自动化和人工智能领域有一定影响力，并且发表半年后就已获他人引用。
>
> 页 28: 我的报告到此结束。恳请各位评委老师批评指正！

### 中文讲稿（大创项目结题答辩，全文）

原稿没有分页，中英文标点混用；输出时统一用全角标点。

> 各位老师，同学，大家好！
>
> 非常荣幸能代表项目组在这里分享我们项目的研究内容和成果，我们的研究课题是"基于软标签学习和张量低秩逼近的多视图特征选择方法"。
>
> 从三个关键词阐述我们工作的主要内容：
> 一是半监督或无监督，数据标注的昂贵性要求算法尽量少用甚至不用标注标签信息，适应了减少标签的趋势。
> 二是多视图，随着数据存储和处理技术的发展，多视图数据不断涌现，对算法提出了在多视图数据上应用的要求。
> 三是特征选择，作为机器学习中特征处理领域的重要研究方向，能有效减少噪声特征影响，避免维度灾难。
>
> 我们总体的工作由两部分组成，分别是"基于软标签学习的单视图特征选择方法"，以及"基于软标签学习和张量低秩逼近的多视图特征选择方法"。
>
> 我们注意到，在有监督的机器学习模型中，标签为模型学习提供方向指导。而在标签不完整的数据中，显然无法再借助真实标签指导模型学习，因而需要借助数据中的先验知识建立伪标签。
>
> 而许多单视图半或无监督特征选择领域的现存工作都忽略了数据中存在的模糊性，使用非 0 即 1 的硬标签作为语义监督信息指导特征选择。相比而言，代表样本和聚类中心间关系的软标签包含更丰富语义监督信息。
>
> 在对多视图特征选择方法分析时，我们发现现存工作使用的多视图学习方法太过简单，例如取每个视图伪标签的加权和，或是简单的拼接各个视图伪标签。我们认为引入张量核范数约束可以更好的学习到多个视图间的一致性和多样性。
>
> 基于上述分析和思考，我们分别提出了单视图特征选择方法 SFS-SLL 和多视图特征选择方法 MESA。
>
> 在单视图中：在迭代过程前，我们通过模糊聚类得到初始软标签矩阵。其中 A⁽ᵛ⁾ 是软标签矩阵，U⁽ᵛ⁾ 是初始软标签矩阵，L⁽ᵛ⁾ 是原始标签矩阵，P⁽ᵛ⁾ 是特征选择矩阵。公式 1 的第一至三项代表：在迭代过程中，软标签矩阵在初始软标签矩阵和真实标签的指导下不断优化。第四，五项则代表特征选择过程，且该过程也会促进软标签的学习。
>
> 之后，我们以第一部分工作为基础，添加张量核范数约束，拓宽方法到多视图领域中，确定无监督多视图特征选择目标函数如下。其中 ‖·‖⊛ 是由 t-SVD 定义的张量核范数。之后通过引入辅助变量迭代求解各变量。
>
> 具体来说，本项目提出的方法在以下几个方面具有重要意义：
> - 引入了软标签学习策略。相较于现有方法，MESA 考虑了数据中存在的模糊性，使用软标签作为语义监督信息指导特征选择，从而更好地反映数据的特点，提高了伪标签的质量和特征选择的效果。
> - 引入了张量核范数约束。MESA 利用多视图数据中的一致性和多样性，在学习单独视图的语义监督信息后借助核范数的低秩约束，提高伪标签质量。
> - 提高了算法的准确率和运行效率。MESA 通过将初始软标签建立的过程分离出迭代过程，同时，采用交替方向乘子法（ADMM）迭代更新软标签和特征选择矩阵等变量，提高算法运行效率。
>
> 综上，本项目提出了一种有效的单视图特征选择方法，并将其拓展至多视图领域，可以提高特征选择、数据降维的效率和准确性，具有较广泛的应用意义。实验结果表明了我们的方法的优越性。
>
> 第一部分所对应的论文"Semi-supervised Feature Selection with Soft Label Learning"成功被 IEEE/CAA JAS 接收。一些实验结果如表所示。
>
> 第二部分中，我们也进行了一些实验，实验结果也证明了我们所提出的多视图特征选择方法在聚类任务的 ACC 和 NMI 指标上具有一定优越性。
>
> 总体而言，我们项目工作进展顺利，符合项目预期，项目组成员也在其中得到了锻炼和成长。
>
> 请各位老师和同学批评指正！

### English speech notes (bachelor thesis defense, excerpts)

> 1. Good morning, reviewers and students! I am Chengrui Zhang, and the topic of my research is ``Operator Learning for Partial Differential Equations with Attention Mechanism''.
>
> 2. In the following, I will explain my research in four aspects: motivation, method, experiments and conclusion.
>
> 3. There is no doubt that the creation and solution of partial differential equations have always been an important concern in many fields of scientific research. Many methods, such as finite element methods, have been created and continuously developed over the past decades to solve partial differential equations.
>
> 4. However, these traditional methods are limited by time complexity and are difficult to solve high-dimensional problems and parametric partial differential equations.
>
> 7. Despite the high solution accuracy of this class of methods, the implementation code of the model needs to be adjusted once any parameter, the initial and boundary conditions of the equation are modified. The neural network in the model also needs to be re-trained. In addition, the loss function often has more terms, which may leads to the difficulty of the training process. These problems limit the application ability of such methods.
>
> 11. However, this approach is not very flexible, and the problem is its difficulty in dealing with non-uniform grids and super-resolution cases. The concept of non-uniform grids is easy to understand. Super-resolution means that the input and output functions have different grid settings.
>
> 16. An important contribution of my work is a more complete source code based on the Fourier/Galerkin Transformer. In fact, the biggest challenge in implementing the code was to understand and restruct the original code, which had many logical errors.
>
> 19. I conducted experiments on the 1D Burgers equation, choosing the Fourier/Galerkin Transformer and FNO as comparison methods. All experiments are conducted on two A100-40GB-SXM graphic cards. The proposed method demonstrates lower accuracy than both the Fourier Transformer (FT) and Galerkin Transformer (GT) methods.
>
> 20. The reasons are that: With only 1,000 data samples for training, a limited dataset fosters a tendency for the method to overfit. Additionally, the model exhibits a trend to decrease the loss value even after all iterations are completed. This indicates that the proposed method has the potential not only to achieve but also to surpass the performance of the Fourier/Galerkin Transformer.
>
> 22. Overall, in this research work, I address the issue of flexibility in the Fourier/Galerkin Transformer by introducing the cross-attention module. Based on this idea, I have written a high quality codebase from scratch, which will be the basis for future research. However, it should be noted that there are many shortcomings in this research work. First, the experimental results obtained so far have not been able to achieve SOTA performance. Secondly, detailed experiments have not been carried out to verify the performance of the proposed method on different partial differential equations.
>
> 23. Moreover, in the research process, Prof. Bo Yu and Xuping Zhang helped me a lot in this process. In the future, based on this research work, I will further improve the method details and code implementation, carry out a lot of experiments, and look forward to completing a work that serves as a baseline for this research area.
>
> 24. Thanks to the reviewers!

### Slide（中文 slide 文本与英文 beamer 源码）

中文，四页连续（每段是一页）：

```text
【数据与机器学习模型性能间的矛盾】
信息技术的发展使数据不断涌现，推动了机器学习的飞跃¹；
  受益于网络各渠道（维基百科、Reddit、搜索结果等）提供的大量的数据，ChatGPT 才能在多个任务上表现优秀。
数据中存在的问题往往会影响模型的性能，提出新的挑战²。
  训练 ChatGPT 模型时，OpenAI 的研究者关注的一个重点问题是如何处理数据集。

【数据中的主要问题】
高维：维度灾难；
冗余/噪声：呈现伪相关。
(a) 维度数量和分类器性能的关系　(b) 噪声特征会使数据呈现伪相关关系
图 1: 数据中的问题

【半监督数据中缺乏完整标签信息】
同时包含"有标签"和"无标签"数据 ⟹ 半监督数据 ⟹ 需要构建伪标签作为语义监督信息。

【研究现状：半监督特征选择】
许多方法使用非 0 即 1 的硬标签作为语义监督信息；
许多方法中标签学习和特征选择过程相互独立；
SemiFS⁴ 方法:  Stage 1 构建初始伪标签；Stage 2 进行特征选择。
⟹ 算法性能严重依赖初始伪标签的质量！
```

"改进和创新"一页分三次展开，每次追加一条："软标签替代硬标签，引入监督语义约束模块；" → "标签学习过程和特征选择过程交互；" → "提高算法运行效率。"

英文 beamer：

```latex
\begin{frame}{Deep Learning for PDE: Neural-FEM}
	\only<1>{ % figure: PINN building blocks, with \footfullcite
	}
	\only<2>{
		\begin{description}
			\item[\color{red}pros.] PINNs can achieve high accuracy on PDE solving problems.
			\item[\color{blue}cons 1.] The implementation code of the model needs to be adjusted once any parameter, the initial and boundary conditions of the equation are modified.
			\item[\color{blue}cons 2.] The loss function often has more terms, which may leads to the difficulty of the training process.
		\end{description}
	}
\end{frame}
\begin{frame}{Related Works: Fourier/Galerkin Transformer}
	\begin{asparadesc}
		\item[Problem.] The approach is not {\color{red} flexible}.
		The method {\color{blue} cannot deal with non-uniform grids and super-resolution cases}.
		\item[Super-resolution.] The input and output functions have different grid settings.
	\end{asparadesc}
\end{frame}
```
